/**
 * Invoice Image Generator — Pure Canvas 2D API
 * 
 * Builds invoice and payment QR images entirely using the Canvas 2D API.
 * NO html2canvas — all text, lines, boxes, and QR codes are drawn directly
 * onto a canvas, which is then exported as a PNG blob.
 * 
 * This approach is 100% reliable across all browsers and devices because
 * there's no DOM cloning, no image loading, and no external rendering library.
 */

import { BillSummary, PharmacyDetails, generateUpiPaymentLink } from './billing-engine';

// ─── Canvas Drawing Helpers ───────────────────────────────────────────────────

const SCALE = 2; // Retina quality
const CANVAS_WIDTH = 400;
const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO_FONT = '"Courier New", Courier, monospace';

function createCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  return [canvas, ctx];
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    size?: number;
    weight?: string;
    color?: string;
    align?: CanvasTextAlign;
    font?: string;
    maxWidth?: number;
  } = {}
): number {
  const size = opts.size || 12;
  const weight = opts.weight || '400';
  const color = opts.color || '#111827';
  const font = opts.font || FONT_FAMILY;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = 'top';
  
  if (opts.maxWidth) {
    // Word wrap
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    const lineHeight = size * 1.3;
    
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > opts.maxWidth && line) {
        ctx.fillText(line, x, currentY);
        line = word;
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, currentY);
    return currentY + lineHeight - y;
  }
  
  ctx.fillText(text, x, y);
  return size * 1.3;
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string = '#d1d5db',
  width: number = 1,
  dash?: number[]
): void {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  else ctx.setLineDash([]);
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number,
  opts: { fill?: string; stroke?: string; strokeWidth?: number } = {}
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  if (opts.fill) {
    ctx.fillStyle = opts.fill;
    ctx.fill();
  }
  if (opts.stroke) {
    ctx.strokeStyle = opts.stroke;
    ctx.lineWidth = opts.strokeWidth || 1;
    ctx.stroke();
  }
}

// ─── Invoice Image Generator ──────────────────────────────────────────────────

/**
 * Generates a full invoice image as a PNG Blob using Canvas 2D API.
 * Completely bypasses html2canvas — draws everything directly.
 */
export async function generateInvoiceImage(
  bill: BillSummary,
  pharmacy: PharmacyDetails
): Promise<Blob | null> {
  const cleanUpi = (pharmacy.upiId || 'manojmedical@okhdfcbank').trim();
  const upiLink = generateUpiPaymentLink(bill.netPayable, bill.invoiceNo, pharmacy);

  // Generate QR as a standalone canvas
  let qrCanvas: HTMLCanvasElement | null = null;
  if (cleanUpi) {
    try {
      const { default: QRCode } = await import('qrcode');
      qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, upiLink, {
        width: 140,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
    } catch (e) {
      console.warn('QR generation failed:', e);
    }
  }

  // Calculate canvas height
  const PAD = 24;
  const W = CANVAS_WIDTH;
  const innerW = W - PAD * 2;
  let estimatedHeight = PAD; // top padding
  estimatedHeight += 60; // header
  estimatedHeight += 50; // invoice meta
  estimatedHeight += 60; // customer info
  estimatedHeight += 30 + bill.items.length * 28; // table header + rows
  estimatedHeight += 100; // totals
  if (cleanUpi) estimatedHeight += 220; // QR section
  estimatedHeight += 50; // footer
  estimatedHeight += PAD; // bottom padding

  const [canvas, ctx] = createCanvas(W, estimatedHeight);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, estimatedHeight);

  // Border
  drawRoundedRect(ctx, 1, 1, W - 2, estimatedHeight - 2, 8, { stroke: '#e5e7eb' });

  let y = PAD;

  // ─── Header ─────────────────────────────────────────────────────────
  drawText(ctx, pharmacy.name.toUpperCase(), W / 2, y, {
    size: 18, weight: '800', color: '#0d9488', align: 'center',
  });
  y += 24;
  drawText(ctx, pharmacy.address, W / 2, y, {
    size: 11, color: '#6b7280', align: 'center',
  });
  y += 16;
  drawText(ctx, `📞 ${pharmacy.phone}`, W / 2, y, {
    size: 11, color: '#6b7280', align: 'center',
  });
  y += 18;
  drawLine(ctx, PAD, y, W - PAD, y, '#0d9488', 2);
  y += 12;

  // ─── Invoice Meta ───────────────────────────────────────────────────
  drawText(ctx, 'Invoice No:', PAD, y, { size: 11, color: '#6b7280' });
  drawText(ctx, 'Date:', W - PAD, y, { size: 11, color: '#6b7280', align: 'right' });
  y += 14;
  drawText(ctx, bill.invoiceNo, PAD, y, { size: 11, weight: '700', color: '#111827' });
  drawText(ctx, bill.date, W - PAD, y, { size: 11, weight: '700', color: '#111827', align: 'right' });
  y += 18;

  // ─── Customer Info ──────────────────────────────────────────────────
  drawRoundedRect(ctx, PAD, y, innerW, bill.doctorName ? 50 : (bill.customerPhone ? 38 : 28), 6, { fill: '#f0fdfa' });
  y += 8;
  const patientText = `Patient: ${bill.customerName}${bill.customerVillage ? ` (${bill.customerVillage})` : ''}`;
  drawText(ctx, patientText, PAD + 10, y, { size: 11, weight: '600', color: '#111827', maxWidth: innerW - 20 });
  y += 16;
  if (bill.customerPhone) {
    drawText(ctx, `Phone: ${bill.customerPhone}`, PAD + 10, y, { size: 11, color: '#6b7280' });
    y += 14;
  }
  if (bill.doctorName) {
    drawText(ctx, `Dr: ${bill.doctorName}`, PAD + 10, y, { size: 11, color: '#6b7280' });
    y += 14;
  }
  y += 8;

  // ─── Items Table ────────────────────────────────────────────────────
  // Column positions
  const col = {
    num: PAD + 4,
    item: PAD + 24,
    qty: PAD + innerW * 0.55,
    mrp: PAD + innerW * 0.68,
    disc: PAD + innerW * 0.82,
    amt: W - PAD - 4,
  };

  // Table header background
  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(PAD, y, innerW, 22);
  drawLine(ctx, PAD, y + 22, W - PAD, y + 22, '#d1d5db', 2);

  const headerY = y + 6;
  const headerOpts = { size: 10, weight: '600', color: '#6b7280' } as const;
  drawText(ctx, '#', col.num, headerY, headerOpts);
  drawText(ctx, 'ITEM', col.item, headerY, headerOpts);
  drawText(ctx, 'QTY', col.qty, headerY, { ...headerOpts, align: 'center' as const });
  drawText(ctx, 'MRP', col.mrp, headerY, { ...headerOpts, align: 'right' as const });
  drawText(ctx, 'DISC', col.disc, headerY, { ...headerOpts, align: 'center' as const });
  drawText(ctx, 'AMT', col.amt, headerY, { ...headerOpts, align: 'right' as const });
  y += 26;

  // Table rows
  for (let i = 0; i < bill.items.length; i++) {
    const item = bill.items[i];
    const rowY = y + 6;
    
    // Truncate long item names
    ctx.font = `600 12px ${FONT_FAMILY}`;
    let itemName = item.name;
    while (ctx.measureText(itemName).width > innerW * 0.30 && itemName.length > 10) {
      itemName = itemName.slice(0, -1);
    }
    if (itemName !== item.name) itemName += '…';

    drawText(ctx, `${i + 1}`, col.num, rowY, { size: 12, color: '#374151' });
    drawText(ctx, itemName, col.item, rowY, { size: 12, weight: '600', color: '#111827' });
    drawText(ctx, `${item.quantity}`, col.qty, rowY, { size: 12, color: '#374151', align: 'center' });
    drawText(ctx, `₹${item.effectiveRate.toFixed(2)}`, col.mrp, rowY, { size: 12, color: '#374151', align: 'right' });
    drawText(ctx, `${item.discountPercent}%`, col.disc, rowY, { size: 12, color: '#374151', align: 'center' });
    drawText(ctx, `₹${item.netTotal.toFixed(2)}`, col.amt, rowY, { size: 12, weight: '600', color: '#111827', align: 'right' });

    y += 28;
    drawLine(ctx, PAD, y, W - PAD, y, '#e5e7eb');
  }
  y += 8;

  // ─── Totals ─────────────────────────────────────────────────────────
  drawLine(ctx, PAD, y, W - PAD, y, '#d1d5db', 2);
  y += 10;

  // Total MRP
  drawText(ctx, 'Total MRP:', PAD, y, { size: 12, color: '#6b7280' });
  drawText(ctx, `₹${bill.grossAmount.toFixed(2)}`, W - PAD, y, { size: 12, align: 'right' });
  y += 18;

  // Discount
  if (bill.totalDiscount > 0) {
    drawText(ctx, `🎉 Discount (${bill.savingsPercent}%):`, PAD, y, { size: 12, color: '#059669' });
    drawText(ctx, `-₹${bill.totalDiscount.toFixed(2)}`, W - PAD, y, { size: 12, color: '#059669', align: 'right' });
    y += 18;
  }

  // Round off
  if (bill.roundOff !== 0) {
    drawText(ctx, 'Round Off:', PAD, y, { size: 12, color: '#6b7280' });
    drawText(ctx, `${bill.roundOff > 0 ? '+' : ''}₹${bill.roundOff.toFixed(2)}`, W - PAD, y, { size: 12, color: '#6b7280', align: 'right' });
    y += 18;
  }

  // Net Payable
  drawLine(ctx, PAD, y, W - PAD, y, '#0d9488', 2);
  y += 10;
  drawText(ctx, 'NET PAYABLE:', PAD, y, { size: 14, weight: '800', color: '#0d9488' });
  drawText(ctx, `₹${bill.netPayable}`, W - PAD, y, { size: 14, weight: '800', color: '#0d9488', align: 'right' });
  y += 22;

  // Payment mode
  drawText(ctx, `Payment: ${bill.paymentMode.toUpperCase()}`, W / 2, y, {
    size: 11, color: '#6b7280', align: 'center', weight: '600',
  });
  y += 18;

  // ─── QR Code Section ───────────────────────────────────────────────
  if (cleanUpi) {
    drawLine(ctx, PAD, y, W - PAD, y, '#d1d5db', 1, [4, 4]);
    y += 14;

    drawText(ctx, 'Scan to Pay via UPI', W / 2, y, {
      size: 11, weight: '600', color: '#4b5563', align: 'center',
    });
    y += 18;

    // QR border box
    const qrBoxSize = 156; // 140 QR + 8 padding each side
    const qrBoxX = (W - qrBoxSize) / 2;
    drawRoundedRect(ctx, qrBoxX, y, qrBoxSize, qrBoxSize, 12, {
      fill: '#ffffff', stroke: '#e5e7eb', strokeWidth: 2,
    });

    // Draw QR code directly onto canvas
    if (qrCanvas) {
      const qrDrawSize = 140;
      const qrX = (W - qrDrawSize) / 2;
      const qrY = y + 8;
      ctx.drawImage(qrCanvas, qrX, qrY, qrDrawSize, qrDrawSize);
    }
    y += qrBoxSize + 8;

    // UPI ID
    drawText(ctx, cleanUpi, W / 2, y, {
      size: 11, weight: '700', color: '#0d9488', align: 'center', font: MONO_FONT,
    });
    y += 20;
  }

  // ─── Footer ─────────────────────────────────────────────────────────
  drawLine(ctx, PAD, y, W - PAD, y, '#e5e7eb');
  y += 10;
  drawText(ctx, '🙏 धन्यवाद! Get Well Soon!', W / 2, y, {
    size: 11, color: '#6b7280', align: 'center',
  });
  y += 16;
  drawText(ctx, `${pharmacy.name} • ${pharmacy.address}`, W / 2, y, {
    size: 9, color: '#9ca3af', align: 'center',
  });
  y += 16;

  // Trim canvas to actual content height
  const finalHeight = y + 8;
  const [finalCanvas, finalCtx] = createCanvas(W, finalHeight);
  finalCtx.fillStyle = '#ffffff';
  finalCtx.fillRect(0, 0, W, finalHeight);
  // Draw at scale=1 since both canvases are already scaled
  finalCtx.setTransform(1, 0, 0, 1, 0, 0);
  finalCanvas.getContext('2d')!.drawImage(canvas, 0, 0, W * SCALE, finalHeight * SCALE, 0, 0, W * SCALE, finalHeight * SCALE);
  // Re-draw border on final
  finalCtx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  drawRoundedRect(finalCtx, 1, 1, W - 2, finalHeight - 2, 8, { stroke: '#e5e7eb' });

  return new Promise<Blob | null>((resolve) => {
    finalCanvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
  });
}

// ─── Payment QR Card Image Generator ──────────────────────────────────────────

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
 * Generates a payment QR card image as a PNG Blob using Canvas 2D API.
 */
export async function generatePaymentQrImage(details: QrCardDetails): Promise<Blob | null> {
  const numAmount = typeof details.amount === 'string' ? parseFloat(details.amount) || 0 : Number(details.amount) || 0;
  const formattedAmount = numAmount.toFixed(2);
  const cleanUpi = (details.upiId || 'manojmedical@okhdfcbank').trim();
  const payee = (details.payeeName || 'Manoj Medical Hall').trim();
  const note = details.note || 'Medicine Bill';
  const upiLink = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(payee)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(note)}`;

  // Generate QR canvas
  let qrCanvas: HTMLCanvasElement | null = null;
  try {
    const { default: QRCode } = await import('qrcode');
    qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, upiLink, {
      width: 220,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  } catch (e) {
    console.warn('Payment QR generation failed:', e);
  }

  const W = 380;
  const PAD = 24;
  const H = 520;
  const [canvas, ctx] = createCanvas(W, H);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  drawRoundedRect(ctx, 1, 1, W - 2, H - 2, 24, { fill: '#ffffff', stroke: '#0d9488', strokeWidth: 2 });

  let y = 28;

  // ─── NPCI Badge ─────────────────────────────────────────────────────
  const badgeText = 'NPCI Verified UPI QR';
  ctx.font = `700 11px ${FONT_FAMILY}`;
  const badgeW = ctx.measureText(badgeText).width + 24;
  drawRoundedRect(ctx, (W - badgeW) / 2, y, badgeW, 22, 11, { fill: '#f0fdfa', stroke: '#99f6e4' });
  drawText(ctx, badgeText, W / 2, y + 5, { size: 11, weight: '700', color: '#0d9488', align: 'center' });
  y += 30;

  // ─── Shop Name ──────────────────────────────────────────────────────
  drawText(ctx, payee.toUpperCase(), W / 2, y, {
    size: 18, weight: '800', color: '#0f172a', align: 'center',
  });
  y += 22;
  const addressLine = `सरफुद्दीनपुर, गोपालपुर (मुज़फ़्फ़रपुर)${details.pharmacyPhone ? ` • Ph: ${details.pharmacyPhone}` : ''}`;
  drawText(ctx, addressLine, W / 2, y, { size: 11, color: '#64748b', align: 'center' });
  y += 20;

  // ─── Amount Badge ───────────────────────────────────────────────────
  drawRoundedRect(ctx, PAD, y, W - PAD * 2, details.customerName ? 82 : 66, 16, { fill: '#f8fafc', stroke: '#e2e8f0' });
  y += 10;
  drawText(ctx, 'AMOUNT TO PAY', W / 2, y, {
    size: 11, weight: '600', color: '#64748b', align: 'center',
  });
  y += 16;
  drawText(ctx, `₹${formattedAmount}`, W / 2, y, {
    size: 32, weight: '900', color: '#0d9488', align: 'center',
  });
  y += 38;
  if (details.customerName) {
    drawText(ctx, `Customer: ${details.customerName}`, W / 2, y, {
      size: 11, weight: '600', color: '#334155', align: 'center',
    });
    y += 16;
  }
  if (note) {
    drawText(ctx, `"${note}"`, W / 2, y, {
      size: 10, color: '#94a3b8', align: 'center',
    });
    y += 14;
  }
  y += 6;

  // ─── QR Code Box ───────────────────────────────────────────────────
  const qrBoxSize = 244; // 220 + 12 padding each side
  const qrBoxX = (W - qrBoxSize) / 2;
  drawRoundedRect(ctx, qrBoxX, y, qrBoxSize, qrBoxSize, 20, {
    fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 2,
  });

  if (qrCanvas) {
    const qrDrawSize = 220;
    const qrX = (W - qrDrawSize) / 2;
    const qrY = y + 12;
    ctx.drawImage(qrCanvas, qrX, qrY, qrDrawSize, qrDrawSize);
  }
  y += qrBoxSize + 14;

  // ─── UPI ID ─────────────────────────────────────────────────────────
  drawText(ctx, 'UPI ID', W / 2, y, { size: 10, color: '#64748b', align: 'center' });
  y += 14;
  // UPI ID badge
  ctx.font = `700 12px ${MONO_FONT}`;
  const upiW = ctx.measureText(cleanUpi).width + 24;
  drawRoundedRect(ctx, (W - upiW) / 2, y, upiW, 24, 8, { fill: '#f0fdfa', stroke: '#ccfbf1' });
  drawText(ctx, cleanUpi, W / 2, y + 5, {
    size: 12, weight: '700', color: '#0f766e', align: 'center', font: MONO_FONT,
  });
  y += 34;

  // ─── Footer ─────────────────────────────────────────────────────────
  drawLine(ctx, PAD, y, W - PAD, y, '#cbd5e1', 1, [4, 4]);
  y += 12;
  drawText(ctx, 'Scan & Pay using Google Pay, PhonePe, Paytm, BHIM or any UPI App', W / 2, y, {
    size: 10, color: '#64748b', align: 'center', maxWidth: W - PAD * 2,
  });
  y += 18;
  drawText(ctx, '🙏 मनोज मेडिकल हॉल में खरीदारी के लिए धन्यवाद!', W / 2, y, {
    size: 10, weight: '700', color: '#0d9488', align: 'center',
  });

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
  });
}

// ─── Download & Share Functions ───────────────────────────────────────────────

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

  // Fallback: Download + WhatsApp text
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

  // Fallback: Download + WhatsApp text
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
