/**
 * Invoice Image Generator
 * 
 * Generates a professional invoice PNG image from billing data.
 * Used for sharing invoices via WhatsApp as images instead of plain text.
 * Includes embedded UPI QR code for payment.
 */

import { BillSummary, PharmacyDetails, generateUpiPaymentLink } from './billing-engine';

/**
 * Generates an HTML invoice string suitable for rendering to canvas/image.
 */
export function generateInvoiceHTML(
  bill: BillSummary,
  pharmacy: PharmacyDetails
): string {
  const upiLink = generateUpiPaymentLink(bill.netPayable, bill.invoiceNo, pharmacy);
  const cleanUpi = (pharmacy.upiId || '').trim();

  const itemRows = bill.items
    .map(
      (item, idx) => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:6px 4px;font-size:12px;color:#374151;">${idx + 1}</td>
        <td style="padding:6px 4px;font-size:12px;color:#111827;font-weight:600;">${item.name}</td>
        <td style="padding:6px 4px;font-size:12px;color:#374151;text-align:center;">${item.quantity}</td>
        <td style="padding:6px 4px;font-size:12px;color:#374151;text-align:right;">₹${item.effectiveRate.toFixed(2)}</td>
        <td style="padding:6px 4px;font-size:12px;color:#374151;text-align:center;">${item.discountPercent}%</td>
        <td style="padding:6px 4px;font-size:12px;color:#111827;text-align:right;font-weight:600;">₹${item.netTotal.toFixed(2)}</td>
      </tr>`
    )
    .join('');

  return `
  <div id="invoice-container" style="width:400px;background:white;padding:24px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;border:1px solid #e5e7eb;border-radius:8px;">
    
    <!-- Header -->
    <div style="text-align:center;border-bottom:2px solid #0d9488;padding-bottom:12px;margin-bottom:12px;">
      <h1 style="font-size:18px;font-weight:800;color:#0d9488;margin:0;letter-spacing:0.5px;">${pharmacy.name.toUpperCase()}</h1>
      <p style="font-size:11px;color:#6b7280;margin:4px 0 0 0;">${pharmacy.address}</p>
      <p style="font-size:11px;color:#6b7280;margin:2px 0 0 0;">📞 ${pharmacy.phone}</p>
    </div>

    <!-- Invoice Meta -->
    <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:11px;">
      <div>
        <p style="margin:0;color:#6b7280;">Invoice No:</p>
        <p style="margin:0;font-weight:700;color:#111827;">${bill.invoiceNo}</p>
      </div>
      <div style="text-align:right;">
        <p style="margin:0;color:#6b7280;">Date:</p>
        <p style="margin:0;font-weight:700;color:#111827;">${bill.date}</p>
      </div>
    </div>

    <!-- Customer Info -->
    <div style="background:#f0fdfa;padding:8px 10px;border-radius:6px;margin-bottom:12px;font-size:11px;">
      <p style="margin:0;"><strong>Patient:</strong> ${bill.customerName}${bill.customerVillage ? ` (${bill.customerVillage})` : ''}</p>
      ${bill.customerPhone ? `<p style="margin:2px 0 0 0;color:#6b7280;">Phone: ${bill.customerPhone}</p>` : ''}
      ${bill.doctorName ? `<p style="margin:2px 0 0 0;color:#6b7280;">Dr: ${bill.doctorName}</p>` : ''}
    </div>

    <!-- Items Table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <thead>
        <tr style="background:#f3f4f6;border-bottom:2px solid #d1d5db;">
          <th style="padding:6px 4px;font-size:10px;text-align:left;color:#6b7280;text-transform:uppercase;">#</th>
          <th style="padding:6px 4px;font-size:10px;text-align:left;color:#6b7280;text-transform:uppercase;">Item</th>
          <th style="padding:6px 4px;font-size:10px;text-align:center;color:#6b7280;text-transform:uppercase;">Qty</th>
          <th style="padding:6px 4px;font-size:10px;text-align:right;color:#6b7280;text-transform:uppercase;">MRP</th>
          <th style="padding:6px 4px;font-size:10px;text-align:center;color:#6b7280;text-transform:uppercase;">Disc</th>
          <th style="padding:6px 4px;font-size:10px;text-align:right;color:#6b7280;text-transform:uppercase;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <!-- Totals -->
    <div style="border-top:2px solid #d1d5db;padding-top:8px;font-size:12px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
        <span style="color:#6b7280;">Total MRP:</span>
        <span>₹${bill.grossAmount.toFixed(2)}</span>
      </div>
      ${bill.totalDiscount > 0 ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;color:#059669;">
        <span>🎉 Discount (${bill.savingsPercent}%):</span>
        <span>-₹${bill.totalDiscount.toFixed(2)}</span>
      </div>
      ` : ''}
      ${bill.roundOff !== 0 ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:3px;color:#6b7280;">
        <span>Round Off:</span>
        <span>${bill.roundOff > 0 ? '+' : ''}₹${bill.roundOff.toFixed(2)}</span>
      </div>
      ` : ''}
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #0d9488;margin-top:4px;">
        <span style="font-weight:800;font-size:14px;color:#0d9488;">NET PAYABLE:</span>
        <span style="font-weight:800;font-size:14px;color:#0d9488;">₹${bill.netPayable}</span>
      </div>
      <div style="text-align:center;font-size:11px;color:#6b7280;margin-bottom:4px;">
        Payment: <strong>${bill.paymentMode.toUpperCase()}</strong>
      </div>
    </div>

    <!-- QR Code Placeholder -->
    ${cleanUpi ? `
    <div style="text-align:center;margin-top:12px;padding-top:12px;border-top:1px dashed #d1d5db;">
      <p style="font-size:10px;color:#6b7280;margin:0 0 6px 0;">Scan to pay via UPI</p>
      <div id="invoice-qr-placeholder" data-upi-link="${upiLink}" style="display:inline-block;padding:8px;background:white;border:1px solid #e5e7eb;border-radius:4px;width:120px;height:120px;"></div>
      <p style="font-size:10px;color:#374151;margin:6px 0 0 0;font-family:monospace;">${cleanUpi}</p>
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="text-align:center;margin-top:12px;padding-top:8px;border-top:1px solid #e5e7eb;">
      <p style="font-size:11px;color:#6b7280;margin:0;">🙏 धन्यवाद! Get Well Soon!</p>
      <p style="font-size:9px;color:#9ca3af;margin:4px 0 0 0;">${pharmacy.name} • ${pharmacy.address}</p>
    </div>
  </div>`;
}

/**
 * Renders the invoice to a canvas element and returns it as a Blob (PNG).
 * Uses html2canvas-style rendering via an offscreen iframe.
 */
export async function generateInvoiceImage(
  bill: BillSummary,
  pharmacy: PharmacyDetails
): Promise<Blob | null> {
  // Dynamic import to avoid SSR issues
  const html = generateInvoiceHTML(bill, pharmacy);

  // Create offscreen container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.zIndex = '-9999';
  container.innerHTML = html;
  document.body.appendChild(container);

  // Render QR code into the placeholder using canvas
  const qrPlaceholder = container.querySelector('#invoice-qr-placeholder') as HTMLElement;
  if (qrPlaceholder) {
    const upiLink = qrPlaceholder.getAttribute('data-upi-link') || '';
    if (upiLink) {
      try {
        // Use QRCode library to draw QR into a canvas
        const { default: QRCode } = await import('qrcode');
        const qrCanvas = document.createElement('canvas');
        qrCanvas.width = 120;
        qrCanvas.height = 120;
        await QRCode.toCanvas(qrCanvas, upiLink, {
          width: 120,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        });
        qrPlaceholder.innerHTML = '';
        qrPlaceholder.appendChild(qrCanvas);
      } catch (e) {
        console.warn('QR code generation failed:', e);
      }
    }
  }

  // Use html2canvas to render
  try {
    const { default: html2canvas } = await import('html2canvas');
    const invoiceEl = container.querySelector('#invoice-container') as HTMLElement;
    if (!invoiceEl) {
      document.body.removeChild(container);
      return null;
    }

    const canvas = await html2canvas(invoiceEl, {
      scale: 2, // 2x resolution for crisp images
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });

    document.body.removeChild(container);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
    });
  } catch (e) {
    console.error('Invoice image generation failed:', e);
    document.body.removeChild(container);
    return null;
  }
}

/**
 * Downloads the invoice as a PNG file.
 */
export async function downloadInvoiceImage(
  bill: BillSummary,
  pharmacy: PharmacyDetails
): Promise<void> {
  const blob = await generateInvoiceImage(bill, pharmacy);
  if (!blob) {
    alert('Failed to generate invoice image. Try again.');
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoice-${bill.invoiceNo}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Shares the invoice image via WhatsApp using Web Share API (mobile),
 * or falls back to download + text link.
 */
export async function shareInvoiceViaWhatsApp(
  bill: BillSummary,
  pharmacy: PharmacyDetails
): Promise<void> {
  const blob = await generateInvoiceImage(bill, pharmacy);
  
  if (blob && navigator.share && navigator.canShare) {
    // Use Web Share API (works on mobile Chrome, Safari)
    const file = new File([blob], `Invoice-${bill.invoiceNo}.png`, { type: 'image/png' });
    const shareData = {
      title: `Invoice ${bill.invoiceNo}`,
      text: `🧾 ${pharmacy.name} - Invoice ${bill.invoiceNo}\nAmount: ₹${bill.netPayable}\n🙏 धन्यवाद!`,
      files: [file],
    };
    
    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (e) {
        // User cancelled or share failed, fall through to fallback
        if ((e as Error).name === 'AbortError') return;
      }
    }
  }

  // Fallback: Download the image and open WhatsApp with text message
  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${bill.invoiceNo}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Open WhatsApp with text fallback
  const phone = bill.customerPhone ? bill.customerPhone.replace(/[^0-9]/g, '') : '';
  const cleanPhone = phone.length > 10 && phone.startsWith('91') ? phone : (phone.length === 10 ? '91' + phone : phone);
  const text = `🧾 *${pharmacy.name}* - Invoice ${bill.invoiceNo}\nAmount: ₹${bill.netPayable}\n📎 Invoice image downloaded — please share it in this chat.\n🙏 धन्यवाद!`;
  const waUrl = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}

/**
 * QR Code Card Details for Payment QR Image
 */
export interface QrCardDetails {
  amount: number | string;
  note?: string;
  payeeName?: string;
  upiId: string;
  pharmacyPhone?: string;
  customerName?: string;
  customerPhone?: string;
}

/**
 * Generates an HTML payment QR card string suitable for rendering to canvas/image.
 */
export function generatePaymentQrHTML(details: QrCardDetails): string {
  const numAmount = typeof details.amount === 'string' ? parseFloat(details.amount) || 0 : Number(details.amount) || 0;
  const formattedAmount = numAmount.toFixed(2);
  const cleanUpi = (details.upiId || '').trim();
  const payee = (details.payeeName || 'Manoj Medical Hall').trim();
  const note = details.note || 'Medicine Bill';
  const upiLink = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(payee)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(note)}`;

  return `
  <div id="qr-card-container" style="width:380px;background:#ffffff;padding:28px 24px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;border:2px solid #0d9488;border-radius:24px;text-align:center;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);">
    <!-- Shop Header -->
    <div style="margin-bottom:12px;">
      <span style="display:inline-block;padding:3px 12px;background:#f0fdfa;border:1px solid #99f6e4;color:#0d9488;border-radius:9999px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">NPCI Verified UPI QR</span>
      <h1 style="font-size:18px;font-weight:800;color:#0f172a;margin:8px 0 2px 0;">${payee.toUpperCase()}</h1>
      <p style="font-size:11px;color:#64748b;margin:0;">सरफुद्दीनपुर, गोपालपुर (मुज़फ़्फ़रपुर)${details.pharmacyPhone ? ` • Ph: ${details.pharmacyPhone}` : ''}</p>
    </div>

    <!-- Amount Badge -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:12px;margin-bottom:16px;">
      <p style="font-size:11px;color:#64748b;margin:0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Amount to Pay</p>
      <div style="font-size:32px;font-weight:900;color:#0d9488;margin:2px 0 0 0;">₹${formattedAmount}</div>
      ${details.customerName ? `<p style="font-size:11px;color:#334155;margin:4px 0 0 0;font-weight:600;">Customer: ${details.customerName}</p>` : ''}
      ${note ? `<p style="font-size:10px;color:#94a3b8;margin:2px 0 0 0;font-style:italic;">“${note}”</p>` : ''}
    </div>

    <!-- QR Code Container -->
    <div style="display:inline-block;padding:12px;background:#ffffff;border:2px solid #e2e8f0;border-radius:18px;margin-bottom:14px;">
      <div id="payment-qr-canvas-holder" data-upi-link="${upiLink}" style="width:200px;height:200px;"></div>
    </div>

    <!-- UPI ID and instructions -->
    <div style="margin-bottom:16px;">
      <p style="font-size:10px;color:#64748b;margin:0 0 4px 0;">UPI ID</p>
      <div style="display:inline-block;padding:4px 12px;background:#f0fdfa;border:1px solid #ccfbf1;color:#0f766e;font-size:12px;font-family:monospace;font-weight:700;border-radius:8px;">${cleanUpi}</div>
    </div>

    <!-- Supported Apps -->
    <div style="border-top:1px dashed #cbd5e1;padding-top:12px;">
      <p style="font-size:10px;color:#64748b;margin:0;font-weight:500;">
        Scan &amp; Pay using <strong>Google Pay, PhonePe, Paytm, BHIM</strong> or any UPI App
      </p>
      <p style="font-size:10px;color:#0d9488;font-weight:700;margin:6px 0 0 0;">
        🙏 मनोज मेडिकल हॉल में खरीदारी के लिए धन्यवाद!
      </p>
    </div>
  </div>`;
}

/**
 * Generates payment QR image as Blob (PNG)
 */
export async function generatePaymentQrImage(details: QrCardDetails): Promise<Blob | null> {
  const html = generatePaymentQrHTML(details);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.zIndex = '-9999';
  container.innerHTML = html;
  document.body.appendChild(container);

  const qrHolder = container.querySelector('#payment-qr-canvas-holder') as HTMLElement;
  if (qrHolder) {
    const upiLink = qrHolder.getAttribute('data-upi-link') || '';
    if (upiLink) {
      try {
        const { default: QRCode } = await import('qrcode');
        const qrCanvas = document.createElement('canvas');
        qrCanvas.width = 200;
        qrCanvas.height = 200;
        await QRCode.toCanvas(qrCanvas, upiLink, {
          width: 200,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        qrHolder.innerHTML = '';
        qrHolder.appendChild(qrCanvas);
      } catch (e) {
        console.warn('Payment QR generation failed:', e);
      }
    }
  }

  try {
    const { default: html2canvas } = await import('html2canvas');
    const cardEl = container.querySelector('#qr-card-container') as HTMLElement;
    if (!cardEl) {
      document.body.removeChild(container);
      return null;
    }

    const canvas = await html2canvas(cardEl, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });

    document.body.removeChild(container);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
    });
  } catch (e) {
    console.error('QR card image generation failed:', e);
    document.body.removeChild(container);
    return null;
  }
}

/**
 * Downloads the payment QR card as a PNG image
 */
export async function downloadPaymentQrImage(details: QrCardDetails): Promise<void> {
  const blob = await generatePaymentQrImage(details);
  if (!blob) {
    alert('Failed to generate payment QR image. Try again.');
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const noteClean = (details.note || 'Bill').replace(/[^a-zA-Z0-9]/g, '-');
  a.download = `Payment-QR-${noteClean}-${details.amount}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Shares the Payment QR code image via WhatsApp or falls back to download + WhatsApp link
 */
export async function sharePaymentQrViaWhatsApp(details: QrCardDetails): Promise<void> {
  const blob = await generatePaymentQrImage(details);
  const numAmount = typeof details.amount === 'string' ? parseFloat(details.amount) || 0 : Number(details.amount) || 0;
  const payee = details.payeeName || 'Manoj Medical Hall';

  if (blob && navigator.share && navigator.canShare) {
    const file = new File([blob], `Payment-QR-${numAmount}.png`, { type: 'image/png' });
    const shareData = {
      title: `UPI Payment QR - ₹${numAmount.toFixed(2)}`,
      text: `💳 *${payee}*\nAmount to Pay: ₹${numAmount.toFixed(2)}\nUPI ID: ${details.upiId}\nकृपया QR स्कैन कर Google Pay/PhonePe/Paytm से भुगतान करें।\nधन्यवाद!`,
      files: [file],
    };

    if (navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
  }

  // Fallback: Download image and open WhatsApp
  if (blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Payment-QR-${numAmount}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const phone = details.customerPhone ? details.customerPhone.replace(/[^0-9]/g, '') : '';
  const cleanPhone = phone.length > 10 && phone.startsWith('91') ? phone : (phone.length === 10 ? '91' + phone : phone);
  const text = `💳 *${payee}*\nAmount to Pay: *₹${numAmount.toFixed(2)}*\nUPI ID: \`${details.upiId}\`\n📎 Payment QR image downloaded — please share/scan to pay via Google Pay, PhonePe or Paytm.\n🙏 धन्यवाद!`;
  const waUrl = cleanPhone
    ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}

