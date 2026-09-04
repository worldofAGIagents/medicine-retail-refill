import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

async function sendSingleWhatsApp(payload: {
  prescriptionId?: string;
  customerId?: string;
  phone?: string;
  customerName?: string;
  medicineName?: string;
  daysRemaining?: number;
  refillDate?: string;
  pharmacyName?: string;
}) {
  const {
    prescriptionId,
    customerId,
    phone: rawPhone,
    customerName = 'Valued Customer',
    medicineName = 'Medicine',
    daysRemaining = 2,
    refillDate = '',
    pharmacyName = 'Apollo Lifeline Pharmacy',
  } = payload;

  let phone = rawPhone;
  let targetPrescriptionId = prescriptionId;

  if (!phone && prescriptionId) {
    const p = await db.prescription.findUnique({
      where: { id: prescriptionId },
      include: { customer: true, medicine: true },
    });
    if (p?.customer) {
      phone = p.customer.phone;
      targetPrescriptionId = p.id;
    }
  }

  if (!phone && customerId) {
    const c = await db.customer.findUnique({ where: { id: customerId } });
    if (c) phone = c.phone;
  }

  if (!phone) {
    return { error: 'Customer phone number is required' };
  }

  // Clean phone number: remove spaces, symbols, ensure 91 country code
  const cleanDigits = String(phone).replace(/[^0-9]/g, '');
  const formattedPhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

  const formattedRefillDate = refillDate ? new Date(refillDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '2-3 दिनों में';
  
  const message = daysRemaining <= 0
    ? `नमस्ते ${customerName} जी, आपकी दवाई ${medicineName} समाप्त हो चुकी है (${formattedRefillDate})। स्वास्थ्य बनाए रखने के लिए क्या हम आज ही फ्री होम डिलीवरी भेज दें? रिप्लाई में YES लिखकर भेजें।\n\n- ${pharmacyName}`
    : `नमस्ते ${customerName} जी, आपकी दवाई ${medicineName} ${daysRemaining} दिन में समाप्त होने वाली है (${formattedRefillDate})। खत्म होने से पहले घर बैठे डिलीवरी पाने के लिए कृपया YES लिखकर जवाब दें।\n\n- ${pharmacyName}`;

  const encodedMessage = encodeURIComponent(message);
  const waMeUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

  let apiSent = false;
  let apiError = null;

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

  if (twilioSid && twilioAuthToken) {
    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const authHeader = Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64');
      const formParams = new URLSearchParams();
      formParams.append('From', twilioFrom.startsWith('whatsapp:') ? twilioFrom : `whatsapp:${twilioFrom}`);
      formParams.append('To', `whatsapp:+${formattedPhone}`);
      formParams.append('Body', message);

      const twilioRes = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
      });

      if (twilioRes.ok) {
        apiSent = true;
      } else {
        apiError = await twilioRes.text();
      }
    } catch (err: any) {
      apiError = err.message;
    }
  }

  // Log in RefillLog
  if (targetPrescriptionId) {
    await db.refillLog.create({
      data: {
        prescriptionId: targetPrescriptionId,
        reminderSentAt: new Date(),
        reminderChannel: 'whatsapp',
        status: 'reminded',
      },
    });
  }

  return {
    success: true,
    waMeUrl,
    phone: formattedPhone,
    customerName,
    medicineName,
    message,
    apiSent,
    apiError,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Check if batch dispatch
    if (Array.isArray(body.items)) {
      const results = [];
      for (const item of body.items) {
        const res = await sendSingleWhatsApp(item);
        results.push(res);
      }
      return NextResponse.json({
        success: true,
        isBatch: true,
        total: results.length,
        items: results,
      });
    }

    // Single dispatch
    const result = await sendSingleWhatsApp(body);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('WhatsApp dispatch error:', error);
    return NextResponse.json({ error: error.message || 'Error processing WhatsApp reminder' }, { status: 500 });
  }
}
