/**
 * Invoice Image Generator
 * 
 * Generates a professional invoice PNG image from billing data.
 * Uses a "post-composite" strategy for QR codes:
 * 1. html2canvas renders the HTML with a colored placeholder for the QR area
 * 2. QR is rendered separately via QRCode.toCanvas()
 * 3. The QR canvas is drawn directly onto the output canvas at the placeholder coordinates
 * This bypasses html2canvas's known issues with rendering <img> and <canvas> elements.
 */

import { BillSummary, PharmacyDetails, generateUpiPaymentLink } from './billing-engine';

// Unique marker color for QR placeholder (a very specific magenta that won't appear elsewhere)
const QR_PLACEHOLDER_COLOR = '#FF00FE';

/**
 * Generates an HTML invoice string with a colored placeholder for QR area.
 * The placeholder has a unique background color that we can locate in the rendered canvas.
 */
export function generateInvoiceHTML(
  bill: BillSummary,
  pharmacy: PharmacyDetails
): string {
  const cleanUpi = (pharmacy.upiId || 'manojmedical@okhdfcbank').trim();

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

    <!-- QR Code Placeholder (will be composited after html2canvas) -->
    ${cleanUpi ? `
    <div style="text-align:center;margin-top:14px;padding-top:12px;border-top:1px dashed #d1d5db;">
      <p style="font-size:11px;color:#4b5563;margin:0 0 6px 0;font-weight:600;">Scan to Pay via UPI</p>
      <div style="display:inline-block;padding:8px;background:#ffffff;border:2px solid #e5e7eb;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <div id="qr-placeholder" style="width:140px;height:140px;background:${QR_PLACEHOLDER_COLOR};"></div>
      </div>
      <p style="font-size:11px;color:#0d9488;margin:6px 0 0 0;font-family:monospace;font-weight:700;">${cleanUpi}</p>
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
 * Finds the bounding box of the QR placeholder (magenta rectangle) in a canvas.
 * Scans the canvas pixel data for the marker color.
 */
function findPlaceholderBounds(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Target: #FF00FE = RGB(255, 0, 254)
  const targetR = 255, targetG = 0, targetB = 254;
  const tolerance = 10;
  
  let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
  let found = false;
  
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      
      if (
        Math.abs(r - targetR) <= tolerance &&
        Math.abs(g - targetG) <= tolerance &&
        Math.abs(b - targetB) <= tolerance
      ) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  
  if (!found) return null;
  
  return {
    x: minX,
    y: minY,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  };
}

/**
 * Composites a QR code canvas onto the main canvas at the placeholder location.
 * First fills the placeholder area with white, then draws the QR centered within it.
 */
function compositeQrOntoCanvas(
  mainCanvas: HTMLCanvasElement,
  qrCanvas: HTMLCanvasElement,
  bounds: { x: number; y: number; w: number; h: number }
): void {
  const ctx = mainCanvas.getContext('2d');
  if (!ctx) return;
  
  // Fill the placeholder area with white first (remove the magenta)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  
  // Calculate centered position with a small padding
  const padding = Math.max(4, Math.floor(bounds.w * 0.03));
  const availW = bounds.w - padding * 2;
  const availH = bounds.h - padding * 2;
  const qrSize = Math.min(availW, availH);
  const offsetX = bounds.x + Math.floor((bounds.w - qrSize) / 2);
  const offsetY = bounds.y + Math.floor((bounds.h - qrSize) / 2);
  
  // Draw the QR canvas onto the main canvas
  ctx.drawImage(qrCanvas, offsetX, offsetY, qrSize, qrSize);
}

/**
 * Renders the invoice to a canvas element and returns it as a Blob (PNG).
 * Uses post-composite strategy: html2canvas renders HTML with a colored placeholder,
 * then the QR canvas is drawn directly onto the output canvas.
 */
export async function generateInvoiceImage(
  bill: BillSummary,
  pharmacy: PharmacyDetails
): Promise<Blob | null> {
  const cleanUpi = (pharmacy.upiId || 'manojmedical@okhdfcbank').trim();
  const upiLink = generateUpiPaymentLink(bill.netPayable, bill.invoiceNo, pharmacy);

  // 1. Generate QR as a standalone canvas (NOT as an img or data URL)
  let qrCanvas: HTMLCanvasElement | null = null;
  if (cleanUpi) {
    try {
      const { default: QRCode } = await import('qrcode');
      qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, upiLink, {
        width: 280,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    } catch (e) {
      console.warn('QR canvas generation failed:', e);
      qrCanvas = null;
    }
  }

  // 2. Build HTML with colored placeholder (no img/canvas QR in the DOM)
  const html = generateInvoiceHTML(bill, pharmacy);

  // 3. Mount in DOM
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.zIndex = '-9999';
  container.style.pointerEvents = 'none';
  container.style.background = '#ffffff';
  container.innerHTML = html;
  document.body.appendChild(container);

  // 4. Small delay for layout
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 5. Render to Canvas via html2canvas (captures placeholder as magenta rect)
  try {
    const { default: html2canvas } = await import('html2canvas');
    const invoiceEl = container.querySelector('#invoice-container') as HTMLElement;
    if (!invoiceEl) {
      document.body.removeChild(container);
      return null;
    }

    const mainCanvas = await html2canvas(invoiceEl, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });

    document.body.removeChild(container);

    // 6. Post-composite: find the magenta placeholder and draw QR over it
    if (qrCanvas) {
      const bounds = findPlaceholderBounds(mainCanvas);
      if (bounds) {
        compositeQrOntoCanvas(mainCanvas, qrCanvas, bounds);
      }
    }

    return new Promise<Blob | null>((resolve) => {
      mainCanvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
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
 * Generates an HTML payment QR card with a colored placeholder for QR area.
 */
export function generatePaymentQrHTML(details: QrCardDetails): string {
  const numAmount = typeof details.amount === 'string' ? parseFloat(details.amount) || 0 : Number(details.amount) || 0;
  const formattedAmount = numAmount.toFixed(2);
  const cleanUpi = (details.upiId || 'manojmedical@okhdfcbank').trim();
  const payee = (details.payeeName || 'Manoj Medical Hall').trim();
  const note = details.note || 'Medicine Bill';

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
      ${note ? `<p style="font-size:10px;color:#94a3b8;margin:2px 0 0 0;font-style:italic;">"${note}"</p>` : ''}
    </div>

    <!-- QR Code Placeholder (magenta rect to be replaced post-render) -->
    <div style="display:inline-block;padding:12px;background:#ffffff;border:2px solid #e2e8f0;border-radius:20px;margin-bottom:14px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05);">
      <div id="qr-placeholder" style="width:220px;height:220px;background:${QR_PLACEHOLDER_COLOR};"></div>
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
 * Generates payment QR image as Blob (PNG) using post-composite strategy.
 */
export async function generatePaymentQrImage(details: QrCardDetails): Promise<Blob | null> {
  const numAmount = typeof details.amount === 'string' ? parseFloat(details.amount) || 0 : Number(details.amount) || 0;
  const formattedAmount = numAmount.toFixed(2);
  const cleanUpi = (details.upiId || 'manojmedical@okhdfcbank').trim();
  const payee = (details.payeeName || 'Manoj Medical Hall').trim();
  const note = details.note || 'Medicine Bill';
  const upiLink = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(payee)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(note)}`;

  // 1. Generate QR as a standalone canvas
  let qrCanvas: HTMLCanvasElement | null = null;
  try {
    const { default: QRCode } = await import('qrcode');
    qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, upiLink, {
      width: 440,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  } catch (e) {
    console.warn('Payment QR canvas generation failed:', e);
    qrCanvas = null;
  }

  // 2. Build HTML with placeholder (no img/canvas QR in the DOM)
  const html = generatePaymentQrHTML(details);

  // 3. Mount in DOM
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.zIndex = '-9999';
  container.style.pointerEvents = 'none';
  container.style.background = '#ffffff';
  container.innerHTML = html;
  document.body.appendChild(container);

  // 4. Small delay for layout
  await new Promise((resolve) => setTimeout(resolve, 50));

  // 5. Render via html2canvas (captures placeholder as magenta rect)
  try {
    const { default: html2canvas } = await import('html2canvas');
    const cardEl = container.querySelector('#qr-card-container') as HTMLElement;
    if (!cardEl) {
      document.body.removeChild(container);
      return null;
    }

    const mainCanvas = await html2canvas(cardEl, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });

    document.body.removeChild(container);

    // 6. Post-composite: find the magenta placeholder and draw QR over it
    if (qrCanvas) {
      const bounds = findPlaceholderBounds(mainCanvas);
      if (bounds) {
        compositeQrOntoCanvas(mainCanvas, qrCanvas, bounds);
      }
    }

    return new Promise<Blob | null>((resolve) => {
      mainCanvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
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
