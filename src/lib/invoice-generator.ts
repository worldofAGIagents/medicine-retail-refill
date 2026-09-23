/**
 * Invoice Image Generator — Pure Canvas 2D API
 * 
 * Generates high-resolution invoice and payment QR PNG images for WhatsApp sharing.
 * Completely free of html2canvas or external DOM renderers.
 * 
 * QR Code is rendered directly using QRCode.create() matrix + ctx.fillRect(),
 * guaranteeing 100% synchronous, pixel-perfect rendering across all mobile
 * and desktop browsers with ZERO risk of blank spaces or layout shifts.
 */

import QRCode from 'qrcode';
import { BillSummary, PharmacyDetails, generateUpiPaymentLink } from './billing-engine';
import {
  cleanWhatsAppNumber,
  buildWhatsAppUrl,
  getWhatsAppWebUrl,
  getWhatsAppAppUrl,
  openWhatsAppDirect
} from './utils';

const SCALE = 2; // Retina 2x scale for ultra-crisp output
const CANVAS_WIDTH = 400;
const FONT_FAMILY = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const MONO_FONT = '"Courier New", Courier, monospace';

// ─── Canvas Helper Functions ──────────────────────────────────────────────────

function createCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * SCALE);
  canvas.height = Math.round(height * SCALE);
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
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    const lineHeight = Math.round(size * 1.35);

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
  return Math.round(size * 1.35);
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
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
  x: number,
  y: number,
  w: number,
  h: number,
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

/**
 * Draws a QR code directly onto the 2D canvas context module-by-module.
 * 100% synchronous, zero external image tags, zero network, zero canvas cloning.
 */
function drawQrMatrix(
  ctx: CanvasRenderingContext2D,
  text: string,
  targetX: number,
  targetY: number,
  targetSize: number,
  opts: {
    darkColor?: string;
    lightColor?: string;
    margin?: number;
  } = {}
): boolean {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const moduleCount = qr.modules.size;
    const quietZone = opts.margin ?? 2;
    const totalModules = moduleCount + quietZone * 2;

    const modulePx = Math.max(1, Math.floor(targetSize / totalModules));
    const actualQrSize = modulePx * totalModules;

    const startX = Math.floor(targetX + (targetSize - actualQrSize) / 2);
    const startY = Math.floor(targetY + (targetSize - actualQrSize) / 2);

    // Light background
    ctx.fillStyle = opts.lightColor || '#ffffff';
    ctx.fillRect(startX, startY, actualQrSize, actualQrSize);

    // Dark modules
    ctx.fillStyle = opts.darkColor || '#0f172a';
    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.modules.get(r, c)) {
          ctx.fillRect(
            startX + (c + quietZone) * modulePx,
            startY + (r + quietZone) * modulePx,
            modulePx,
            modulePx
          );
        }
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to draw QR matrix directly:', err);
    return false;
  }
}

// ─── Invoice Image Generator ──────────────────────────────────────────────────

function computeInvoiceHeight(bill: BillSummary, cleanUpi: boolean): number {
  const PAD = 24;
  let h = PAD; // top padding
  h += 68; // header (name, address, phone, divider)
  h += 34; // invoice meta (no, date)
  const custH = bill.doctorName ? 52 : (bill.customerPhone ? 40 : 30);
  h += custH + 16; // customer box + margin
  h += 26 + bill.items.length * 28 + 10; // table header + rows + spacing
  h += 10 + 18; // totals separator + total MRP
  if (bill.totalDiscount > 0) h += 18;
  if (bill.roundOff !== 0) h += 18;
  h += 10 + 24; // net payable separator + amount
  h += 20; // payment mode
  if (cleanUpi) {
    h += 14 + 18 + 158 + 8 + 22 + 14; // dashed line + label + QR box + space + UPI ID + space
  }
  h += 10 + 18 + 16; // footer divider + hindi greeting + shop credits
  h += PAD; // bottom padding
  return h;
}

/**
 * Generates an invoice image as a PNG Blob using pure Canvas 2D API.
 */
export async function generateInvoiceImage(
  bill: BillSummary,
  pharmacy: PharmacyDetails
): Promise<Blob | null> {
  const cleanUpi = (pharmacy.upiId || 'manojmedical@okhdfcbank').trim();
  const upiLink = generateUpiPaymentLink(bill.netPayable, bill.invoiceNo, pharmacy);

  const PAD = 24;
  const W = CANVAS_WIDTH;
  const innerW = W - PAD * 2;
  const H = computeInvoiceHeight(bill, !!cleanUpi);

  const [canvas, ctx] = createCanvas(W, H);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Outer border
  drawRoundedRect(ctx, 1, 1, W - 2, H - 2, 8, { stroke: '#e5e7eb', strokeWidth: 1.5 });

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
  y += 10;

  // ─── Invoice Meta ───────────────────────────────────────────────────
  drawText(ctx, 'Invoice No:', PAD, y, { size: 11, color: '#6b7280' });
  drawText(ctx, 'Date:', W - PAD, y, { size: 11, color: '#6b7280', align: 'right' });
  y += 14;
  drawText(ctx, bill.invoiceNo, PAD, y, { size: 11, weight: '700', color: '#111827' });
  drawText(ctx, bill.date, W - PAD, y, { size: 11, weight: '700', color: '#111827', align: 'right' });
  y += 20;

  // ─── Customer Info ──────────────────────────────────────────────────
  const custBoxH = bill.doctorName ? 52 : (bill.customerPhone ? 40 : 30);
  drawRoundedRect(ctx, PAD, y, innerW, custBoxH, 6, { fill: '#f0fdfa', stroke: '#ccfbf1' });
  y += 7;
  const patientText = `Patient: ${bill.customerName}${bill.customerVillage ? ` (${bill.customerVillage})` : ''}`;
  drawText(ctx, patientText, PAD + 10, y, { size: 11, weight: '600', color: '#111827', maxWidth: innerW - 20 });
  y += 15;
  if (bill.customerPhone) {
    drawText(ctx, `Phone: ${bill.customerPhone}`, PAD + 10, y, { size: 10.5, color: '#6b7280' });
    y += 13;
  }
  if (bill.doctorName) {
    drawText(ctx, `Dr: ${bill.doctorName}`, PAD + 10, y, { size: 10.5, color: '#6b7280' });
    y += 13;
  }
  y += (bill.doctorName || bill.customerPhone) ? 8 : 12;

  // ─── Items Table ────────────────────────────────────────────────────
  const col = {
    num: PAD + 4,
    item: PAD + 24,
    qty: PAD + innerW * 0.55,
    mrp: PAD + innerW * 0.68,
    disc: PAD + innerW * 0.82,
    amt: W - PAD - 4,
  };

  ctx.fillStyle = '#f3f4f6';
  ctx.fillRect(PAD, y, innerW, 22);
  drawLine(ctx, PAD, y + 22, W - PAD, y + 22, '#d1d5db', 2);

  const headerY = y + 5;
  const headerOpts = { size: 10, weight: '600', color: '#6b7280' } as const;
  drawText(ctx, '#', col.num, headerY, headerOpts);
  drawText(ctx, 'ITEM', col.item, headerY, headerOpts);
  drawText(ctx, 'QTY', col.qty, headerY, { ...headerOpts, align: 'center' as const });
  drawText(ctx, 'MRP', col.mrp, headerY, { ...headerOpts, align: 'right' as const });
  drawText(ctx, 'DISC', col.disc, headerY, { ...headerOpts, align: 'center' as const });
  drawText(ctx, 'AMT', col.amt, headerY, { ...headerOpts, align: 'right' as const });
  y += 26;

  for (let i = 0; i < bill.items.length; i++) {
    const item = bill.items[i];
    const rowY = y + 6;

    ctx.font = `600 11.5px ${FONT_FAMILY}`;
    let itemName = item.name;
    while (ctx.measureText(itemName).width > innerW * 0.32 && itemName.length > 8) {
      itemName = itemName.slice(0, -1);
    }
    if (itemName !== item.name) itemName += '…';

    drawText(ctx, `${i + 1}`, col.num, rowY, { size: 11.5, color: '#374151' });
    drawText(ctx, itemName, col.item, rowY, { size: 11.5, weight: '600', color: '#111827' });
    drawText(ctx, `${item.quantity}`, col.qty, rowY, { size: 11.5, color: '#374151', align: 'center' });
    drawText(ctx, `₹${item.effectiveRate.toFixed(2)}`, col.mrp, rowY, { size: 11.5, color: '#374151', align: 'right' });
    drawText(ctx, `${item.discountPercent}%`, col.disc, rowY, { size: 11.5, color: '#374151', align: 'center' });
    drawText(ctx, `₹${item.netTotal.toFixed(2)}`, col.amt, rowY, { size: 11.5, weight: '600', color: '#111827', align: 'right' });

    y += 28;
    drawLine(ctx, PAD, y, W - PAD, y, '#f3f4f6');
  }
  y += 4;

  // ─── Totals ─────────────────────────────────────────────────────────
  drawLine(ctx, PAD, y, W - PAD, y, '#d1d5db', 2);
  y += 10;

  drawText(ctx, 'Total MRP:', PAD, y, { size: 12, color: '#6b7280' });
  drawText(ctx, `₹${bill.grossAmount.toFixed(2)}`, W - PAD, y, { size: 12, align: 'right' });
  y += 18;

  if (bill.totalDiscount > 0) {
    drawText(ctx, `🎉 Discount (${bill.savingsPercent}%):`, PAD, y, { size: 12, color: '#059669' });
    drawText(ctx, `-₹${bill.totalDiscount.toFixed(2)}`, W - PAD, y, { size: 12, color: '#059669', align: 'right' });
    y += 18;
  }

  if (bill.roundOff !== 0) {
    drawText(ctx, 'Round Off:', PAD, y, { size: 12, color: '#6b7280' });
    drawText(ctx, `${bill.roundOff > 0 ? '+' : ''}₹${bill.roundOff.toFixed(2)}`, W - PAD, y, { size: 12, color: '#6b7280', align: 'right' });
    y += 18;
  }

  drawLine(ctx, PAD, y, W - PAD, y, '#0d9488', 2);
  y += 10;
  drawText(ctx, 'NET PAYABLE:', PAD, y, { size: 14, weight: '800', color: '#0d9488' });
  drawText(ctx, `₹${bill.netPayable}`, W - PAD, y, { size: 14, weight: '800', color: '#0d9488', align: 'right' });
  y += 24;

  drawText(ctx, `Payment: ${bill.paymentMode.toUpperCase()}`, W / 2, y, {
    size: 11, color: '#6b7280', align: 'center', weight: '600',
  });
  y += 20;

  // ─── QR Code Section ───────────────────────────────────────────────
  if (cleanUpi) {
    drawLine(ctx, PAD, y, W - PAD, y, '#d1d5db', 1, [4, 4]);
    y += 14;

    drawText(ctx, 'Scan to Pay via UPI', W / 2, y, {
      size: 11, weight: '600', color: '#4b5563', align: 'center',
    });
    y += 18;

    // QR container box
    const qrBoxSize = 158;
    const qrBoxX = Math.round((W - qrBoxSize) / 2);
    drawRoundedRect(ctx, qrBoxX, y, qrBoxSize, qrBoxSize, 14, {
      fill: '#ffffff', stroke: '#e5e7eb', strokeWidth: 2,
    });

    // Draw QR matrix directly inside container
    const qrDrawSize = 142;
    const qrX = Math.round((W - qrDrawSize) / 2);
    const qrY = y + 8;
    drawQrMatrix(ctx, upiLink, qrX, qrY, qrDrawSize, {
      darkColor: '#0f172a',
      lightColor: '#ffffff',
      margin: 1,
    });
    y += qrBoxSize + 8;

    // UPI ID label
    ctx.font = `700 11px ${MONO_FONT}`;
    const upiWidth = ctx.measureText(cleanUpi).width + 20;
    drawRoundedRect(ctx, Math.round((W - upiWidth) / 2), y, upiWidth, 22, 6, {
      fill: '#f0fdfa', stroke: '#ccfbf1',
    });
    drawText(ctx, cleanUpi, W / 2, y + 4, {
      size: 11, weight: '700', color: '#0d9488', align: 'center', font: MONO_FONT,
    });
    y += 28;
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

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
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

function computeQrCardHeight(details: QrCardDetails): number {
  let h = 28; // top pad
  h += 30; // NPCI badge
  h += 24; // payee name
  h += 20; // address
  const amountH = details.customerName ? (details.note ? 98 : 82) : (details.note ? 82 : 68);
  h += amountH + 16;
  h += 246 + 14; // QR box (246px) + margin
  h += 14 + 32; // UPI ID label + badge
  h += 14 + 20 + 20; // dashed line + apps text + thank you
  h += 24; // bottom pad
  return h;
}

/**
 * Generates a payment QR card image as a PNG Blob using pure Canvas 2D API.
 */
export async function generatePaymentQrImage(details: QrCardDetails): Promise<Blob | null> {
  const numAmount = typeof details.amount === 'string' ? parseFloat(details.amount) || 0 : Number(details.amount) || 0;
  const formattedAmount = numAmount.toFixed(2);
  const cleanUpi = (details.upiId || 'manojmedical@okhdfcbank').trim();
  const payee = (details.payeeName || 'Manoj Medical Hall').trim();
  const note = details.note || 'Medicine Bill';
  const upiLink = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(payee)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(note)}`;

  const W = 380;
  const PAD = 24;
  const H = computeQrCardHeight(details);

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
  drawRoundedRect(ctx, Math.round((W - badgeW) / 2), y, badgeW, 22, 11, { fill: '#f0fdfa', stroke: '#99f6e4' });
  drawText(ctx, badgeText, W / 2, y + 5, { size: 11, weight: '700', color: '#0d9488', align: 'center' });
  y += 30;

  // ─── Shop Name ──────────────────────────────────────────────────────
  drawText(ctx, payee.toUpperCase(), W / 2, y, {
    size: 18, weight: '800', color: '#0f172a', align: 'center',
  });
  y += 24;
  const addressLine = `सरफुद्दीनपुर, गोपालपुर (मुज़फ़्फ़रपुर)${details.pharmacyPhone ? ` • Ph: ${details.pharmacyPhone}` : ''}`;
  drawText(ctx, addressLine, W / 2, y, { size: 11, color: '#64748b', align: 'center' });
  y += 20;

  // ─── Amount Badge ───────────────────────────────────────────────────
  const amountBoxH = details.customerName ? (details.note ? 98 : 82) : (details.note ? 82 : 68);
  drawRoundedRect(ctx, PAD, y, W - PAD * 2, amountBoxH, 16, { fill: '#f8fafc', stroke: '#e2e8f0' });
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
  y += 8;

  // ─── QR Code Box ───────────────────────────────────────────────────
  const qrBoxSize = 246;
  const qrBoxX = Math.round((W - qrBoxSize) / 2);
  drawRoundedRect(ctx, qrBoxX, y, qrBoxSize, qrBoxSize, 20, {
    fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 2,
  });

  const qrDrawSize = 224;
  const qrX = Math.round((W - qrDrawSize) / 2);
  const qrY = y + 11;
  drawQrMatrix(ctx, upiLink, qrX, qrY, qrDrawSize, {
    darkColor: '#0f172a',
    lightColor: '#ffffff',
    margin: 1,
  });
  y += qrBoxSize + 14;

  // ─── UPI ID ─────────────────────────────────────────────────────────
  drawText(ctx, 'UPI ID', W / 2, y, { size: 10, color: '#64748b', align: 'center' });
  y += 14;
  ctx.font = `700 12px ${MONO_FONT}`;
  const upiW = ctx.measureText(cleanUpi).width + 24;
  drawRoundedRect(ctx, Math.round((W - upiW) / 2), y, upiW, 24, 8, { fill: '#f0fdfa', stroke: '#ccfbf1' });
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
  pharmacy: PharmacyDetails,
  preferWeb?: boolean
): Promise<string> {
  const cleanPhone = cleanWhatsAppNumber(bill.customerPhone);
  const text = `🧾 *${pharmacy.name}* - Invoice ${bill.invoiceNo}\nAmount: ₹${bill.netPayable}\n📎 Invoice image downloaded — please share it in this chat.\n🙏 धन्यवाद!`;
  const waUrl = buildWhatsAppUrl(cleanPhone, text, preferWeb);

  // 1. Immediately open WhatsApp in a new tab synchronously (zero popup blocking!)
  openWhatsAppDirect(cleanPhone, text, preferWeb);

  // 2. Concurrently generate the high-res canvas invoice and trigger download/clipboard
  try {
    const blob = await generateInvoiceImage(bill, pharmacy);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${bill.invoiceNo}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      // Copy image to clipboard if supported by browser
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Canvas invoice generation warning:', err);
  }

  return waUrl;
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

export async function sharePaymentQrViaWhatsApp(
  details: QrCardDetails,
  preferWeb?: boolean
): Promise<string> {
  const numAmount = typeof details.amount === 'string' ? parseFloat(details.amount) || 0 : Number(details.amount) || 0;
  const payee = details.payeeName || 'Manoj Medical Hall';
  const cleanPhone = cleanWhatsAppNumber(details.customerPhone);
  const text = `💳 *${payee}*\nAmount to Pay: *₹${numAmount.toFixed(2)}*\nUPI ID: \`${details.upiId}\`\n📎 Payment QR image downloaded — please share/scan to pay via Google Pay, PhonePe or Paytm.\n🙏 धन्यवाद!`;
  const waUrl = buildWhatsAppUrl(cleanPhone, text, preferWeb);

  // 1. Immediately open WhatsApp in a new tab synchronously (zero popup blocking!)
  openWhatsAppDirect(cleanPhone, text, preferWeb);

  // 2. Concurrently generate the payment QR image and trigger download/clipboard
  try {
    const blob = await generatePaymentQrImage(details);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payment-QR-${numAmount}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Canvas payment QR generation warning:', err);
  }

  return waUrl;
}

