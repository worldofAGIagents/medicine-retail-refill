import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { renderTemplate, DEFAULT_TEMPLATES } from '@/lib/templates';

// Helper function to send single WhatsApp reminder
async function sendSingleWhatsApp(payload: {
  prescriptionId?: string;
  customerId?: string;
  phone?: string;
  customerName?: string;
  medicineName?: string;
  category?: string;
  daysRemaining?: number;
  refillDate?: string;
  pharmacyName?: string;
  customMessage?: string;
}) {
  const {
    prescriptionId,
    customerId,
    phone: rawPhone,
    customerName = 'Valued Customer',
    medicineName = 'Medicine',
    category,
    daysRemaining = 2,
    refillDate = '',
    pharmacyName: initialPharmacyName,
    customMessage,
  } = payload;

  // 1. Fetch pharmacy settings from database
  const settingRows = await db.pharmacySetting.findMany();
  const settings: Record<string, string> = {};
  for (const r of settingRows) {
    settings[r.key] = r.value;
  }

  const pharmacyName = initialPharmacyName || settings.pharmacyName || 'MedRefill Chemist & Druggist';
  const pharmacyPhone = settings.phone || '';
  const preferredLang = settings.preferredLanguage || 'hindi';
  const hindiTemplate = settings.hindiTemplate || DEFAULT_TEMPLATES.hindiTemplate;
  const englishTemplate = settings.englishTemplate || DEFAULT_TEMPLATES.englishTemplate;
  const infantMilkTemplate = settings.infantMilkTemplate || DEFAULT_TEMPLATES.infantMilkTemplate;
  const overdueTemplate = settings.overdueTemplate || DEFAULT_TEMPLATES.overdueTemplate;

  let phone = rawPhone;
  let targetPrescriptionId = prescriptionId;
  let isInfantMilk = category === 'Infant Milk';

  if ((!phone || !isInfantMilk) && prescriptionId) {
    const p = await db.prescription.findUnique({
      where: { id: prescriptionId },
      include: { customer: true, medicine: true },
    });
    if (p?.customer && !phone) {
      phone = p.customer.phone;
      targetPrescriptionId = p.id;
    }
    if (p?.medicine?.category === 'Infant Milk') {
      isInfantMilk = true;
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
  const formattedRefillDate = refillDate ? new Date(refillDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '2-3 days';

  // Choose template based on category, urgency, and language preference
  let chosenTemplate = preferredLang === 'english' ? englishTemplate : hindiTemplate;
  if (isInfantMilk) {
    chosenTemplate = infantMilkTemplate;
  } else if (daysRemaining <= 0) {
    chosenTemplate = overdueTemplate;
  }

  const message = customMessage || renderTemplate(chosenTemplate, {
    name: customerName,
    medicine: medicineName,
    days: daysRemaining <= 0 ? 'समाप्त' : `${daysRemaining} दिन`,
    date: formattedRefillDate,
    pharmacy: pharmacyName,
    phone: pharmacyPhone,
  });

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

  // Log in RefillLog if connected to prescription
  if (targetPrescriptionId) {
    try {
      await db.refillLog.create({
        data: {
          prescriptionId: targetPrescriptionId,
          reminderChannel: 'whatsapp',
          status: apiSent ? 'reminded' : 'pending',
          reminderSentAt: new Date(),
        },
      });
    } catch (e) {
      console.error('Failed to write refill log:', e);
    }
  }

  return {
    success: true,
    phone: formattedPhone,
    message,
    waMeUrl,
    apiSent,
    apiError,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Batch Dispatch Mode
    if (Array.isArray(body.items)) {
      const results = [];
      for (const item of body.items) {
        const res = await sendSingleWhatsApp(item);
        results.push(res);
      }
      return NextResponse.json({
        success: true,
        batch: true,
        total: results.length,
        results,
      });
    }

    // 2. Single Notification Mode
    const result = await sendSingleWhatsApp(body);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('WhatsApp API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
