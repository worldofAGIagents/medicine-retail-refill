import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateRefill } from '@/lib/refill-engine';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const recipientEmail = body.to || 'worldofagent@gmail.com';
    let pharmacyName = body.pharmacyName;
    if (!pharmacyName) {
      const setting = await db.pharmacySetting.findUnique({ where: { key: 'pharmacyName' } });
      pharmacyName = setting?.value || 'MedRefill Chemist & Druggist';
    }

    // Fetch all active prescriptions
    const prescriptions = await db.prescription.findMany({
      where: { isActive: true },
      include: { customer: true, medicine: true },
    });

    const activeRefills = prescriptions
      .map((p) => {
        let refillCalc = { daysRemaining: 99, urgency: 'ok', nextRefillDate: '' };
        if (p.lastPurchaseDate && p.lastPurchaseQty) {
          const calc = calculateRefill({
            lastPurchaseDate: p.lastPurchaseDate,
            lastPurchaseQty: p.lastPurchaseQty,
            dailyDosage: p.dailyDosage,
            bufferDays: p.bufferDays,
          });
          refillCalc = {
            daysRemaining: calc.daysRemaining,
            urgency: calc.urgency,
            nextRefillDate: calc.nextRefillDate.toISOString(),
          };
        }
        return { ...p, refillCalc };
      })
      .filter((r) => r.refillCalc.daysRemaining <= 3)
      .sort((a, b) => a.refillCalc.daysRemaining - b.refillCalc.daysRemaining);

    const todayDateStr = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const totalAmount = activeRefills.reduce((sum, item) => {
      const packs = Math.ceil((item.lastPurchaseQty || 10) / (item.medicine.unitsPerPack || 10));
      return sum + (item.medicine.mrp * packs);
    }, 0);

    const subject = `📋 Daily Chronic Delivery Plan (${todayDateStr}) - ${pharmacyName}`;

    // Construct clean HTML email
    const rowsHtml = activeRefills
      .map((item, idx) => {
        const days = item.refillCalc.daysRemaining;
        const packs = Math.ceil((item.lastPurchaseQty || 10) / (item.medicine.unitsPerPack || 10));
        const bill = item.medicine.mrp * packs;
        const statusBadge =
          days <= 0
            ? '<span style="color:#b91c1c;font-weight:bold;background:#fee2e2;padding:2px 6px;border-radius:4px;">OVERDUE</span>'
            : days <= 1
            ? '<span style="color:#b45309;font-weight:bold;background:#fef3c7;padding:2px 6px;border-radius:4px;">DUE TODAY</span>'
            : `<span style="color:#1d4ed8;font-weight:bold;background:#dbeafe;padding:2px 6px;border-radius:4px;">${days} DAYS LEFT</span>`;

        return `
        <tr style="border-bottom:1px solid #e5e7eb;font-size:13px;">
          <td style="padding:10px;text-align:center;">${idx + 1}</td>
          <td style="padding:10px;">
            <strong>${item.customer.name}</strong><br/>
            <span style="color:#6b7280;font-size:11px;">📞 ${item.customer.phone}</span>
          </td>
          <td style="padding:10px;color:#374151;">
            ${item.customer.address || `${item.customer.locality || 'Sector 18'}, ${item.customer.city || 'Noida'}`}
          </td>
          <td style="padding:10px;">
            <strong>${item.medicine.name}</strong><br/>
            <span style="color:#0d9488;font-size:11px;">Pack: ${item.customPackaging || `${item.medicine.unitsPerPack} tabs/strip`}</span>
          </td>
          <td style="padding:10px;text-align:center;">
            <strong>${packs} Pack(s)</strong><br/>
            <span style="color:#6b7280;font-size:11px;">(${item.lastPurchaseQty} ${item.unitType || 'tabs'})</span>
          </td>
          <td style="padding:10px;text-align:right;font-weight:bold;color:#111827;">
            ₹${bill.toLocaleString('en-IN')}
          </td>
          <td style="padding:10px;text-align:center;">
            ${statusBadge}
          </td>
        </tr>
      `;
      })
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin:0; padding:20px; background-color:#f9fafb; color:#111827; }
          .container { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; }
          .header { background: #0f766e; color: #ffffff; padding: 24px; }
          .content { padding: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background: #f3f4f6; color: #374151; font-size: 12px; text-transform: uppercase; padding: 10px; text-align: left; }
          .footer { background: #f9fafb; padding: 16px 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; text-align: center; }
          .summary-card { background: #f0fdfa; border: 1px solid #ccfbf1; padding: 16px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;font-size:20px;">${pharmacyName}</h1>
            <p style="margin:4px 0 0 0;font-size:13px;opacity:0.9;">Daily Chronic Medicine Delivery Plan • DL: DL-20B/21B-49201</p>
            <p style="margin:4px 0 0 0;font-size:12px;opacity:0.8;">Date: ${todayDateStr}</p>
          </div>
          <div class="content">
            <div style="background:#f0fdfa;border:1px solid #99f6e4;padding:16px;border-radius:8px;margin-bottom:16px;">
              <table style="width:100%;border:none;margin:0;">
                <tr>
                  <td><strong>Total Deliveries to Prepare:</strong> ${activeRefills.length} Patients</td>
                  <td style="text-align:right;"><strong>Total Cash to Collect:</strong> <span style="font-size:18px;color:#0f766e;font-weight:bold;">₹${totalAmount.toLocaleString('en-IN')}</span></td>
                </tr>
              </table>
            </div>

            <p style="font-size:14px;color:#4b5563;margin-bottom:8px;">
              Here is the automated morning dispatch list of patients whose chronic medicines or infant milk formulas run out within the next 1-3 days:
            </p>

            <table>
              <thead>
                <tr>
                  <th style="text-align:center;">#</th>
                  <th>Patient</th>
                  <th>Delivery Address</th>
                  <th>Medicine</th>
                  <th style="text-align:center;">Qty</th>
                  <th style="text-align:right;">Amount</th>
                  <th style="text-align:center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#9ca3af;">No pending deliveries</td></tr>'}
              </tbody>
            </table>

            <div style="margin-top:24px;padding:16px;background:#f9fafb;border-radius:8px;font-size:12px;color:#4b5563;">
              <strong>Rider Checklist:</strong><br/>
              1. Collect Cash or scan customer UPI QR on doorstep.<br/>
              2. Inspect strip seal & expiry date before handing over.<br/>
              3. Report completed delivery on MedRefill dashboard.
            </div>
          </div>
          <div class="footer">
            MedRefill Automated Pharmacy Delivery Engine • Recipient: ${recipientEmail}
          </div>
        </div>
      </body>
      </html>
    `;

    // Real API dispatch if RESEND_API_KEY is available
    let emailSent = false;
    let emailError = null;

    if (process.env.RESEND_API_KEY) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'MedRefill <onboarding@resend.dev>',
            to: recipientEmail,
            subject,
            html: htmlContent,
          }),
        });

        if (resendRes.ok) {
          emailSent = true;
        } else {
          emailError = await resendRes.text();
        }
      } catch (err: any) {
        emailError = err.message;
      }
    }

    return NextResponse.json({
      success: true,
      recipientEmail,
      subject,
      totalDeliveries: activeRefills.length,
      totalAmount,
      emailSent,
      emailError,
      htmlPreview: htmlContent,
      mailtoUrl: `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
        `Please find the daily pharmacy delivery summary for ${todayDateStr}. Total deliveries: ${activeRefills.length}, Total Amount: Rs. ${totalAmount}.\n\nView online at: http://localhost:3005/delivery-sheet`
      )}`,
    });
  } catch (error: any) {
    console.error('Email report error:', error);
    return NextResponse.json({ error: error.message || 'Error generating email report' }, { status: 500 });
  }
}
