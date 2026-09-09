/**
 * Retail Billing & Invoicing Engine for Manoj Medical Hall
 *
 * Core Rules:
 * - Default 10% discount on MRP for general and chronic medicines.
 * - Default 0% discount on Infant Milk / Baby Formulas (Lactogen, Nan Pro, Similac, Aptamil, etc.) due to very low trade margin (<3%).
 * - Fully editable per-item discount (% or ₹) and optional global bill discount.
 */

import { detectMedicineCategory } from './medicine-classifier';

export interface BillItemInput {
  medicineId?: string;
  name: string;
  genericName?: string;
  category?: string;
  packaging?: string;
  unitsPerPack?: number;
  unitMode?: 'strips' | 'tablets' | 'tins' | 'bottles' | 'units';
  mrp: number; // MRP per unit/strip
  quantity: number; // Number of strips/tins/units
  discountPercent?: number; // Optional override, defaults according to product rules
  customDiscountAmount?: number; // Optional flat ₹ override
}

export interface CalculatedBillItem extends BillItemInput {
  id: string;
  isInfantMilk: boolean;
  effectiveRate: number; // MRP per unit
  grossTotal: number; // mrp * quantity
  discountPercent: number; // applied discount percentage
  discountAmount: number; // total discount in ₹
  netTotal: number; // grossTotal - discountAmount
}

export interface BillSummary {
  invoiceNo: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  customerVillage?: string;
  doctorName?: string;
  paymentMode: 'cash' | 'upi' | 'credit';
  items: CalculatedBillItem[];
  totalItems: number;
  totalQuantity: number;
  grossAmount: number;
  totalDiscount: number;
  extraDiscount: number;
  netPayable: number;
  roundOff: number;
  savingsPercent: number;
}

export interface PharmacyDetails {
  name: string;
  address: string;
  phone: string;
  dlNumber?: string;
  gstin?: string;
  upiId?: string;
  upiPayeeName?: string;
}

/**
 * Checks if a medicine is Infant Milk / Baby Formula
 */
export function isInfantFormula(name: string = '', genericName: string = '', category: string = ''): boolean {
  const text = `${name} ${genericName} ${category}`.toLowerCase();
  if (category === 'Infant Milk' || category.toLowerCase().includes('infant')) {
    return true;
  }
  return /nan\s*pro|lactogen|similac|aptamil|dexolac|infant\s*milk|infant\s*formula|pediasure|nestogen|farex|cerelac|enfamil|isomil/i.test(text);
}

/**
 * Gets default discount percentage for a product:
 * - Infant Milk: 0%
 * - Other medicines: 10%
 */
export function getDefaultDiscountPercent(name: string = '', genericName: string = '', category: string = ''): number {
  if (isInfantFormula(name, genericName, category)) {
    return 0; // 0% default for baby formula
  }
  return 10; // 10% default for standard medicines
}

/**
 * Calculates a single bill line item
 */
export function calculateLineItem(item: BillItemInput, index: number = 0): CalculatedBillItem {
  const isInfant = isInfantFormula(item.name, item.genericName, item.category);
  const qty = Math.max(1, Number(item.quantity) || 1);
  const mrp = Math.max(0, Number(item.mrp) || 0);
  const grossTotal = Math.round(mrp * qty * 100) / 100;

  // Determine discount
  let discPct = item.discountPercent !== undefined
    ? Number(item.discountPercent)
    : getDefaultDiscountPercent(item.name, item.genericName, item.category);

  // Bound discount between 0% and 100%
  discPct = Math.max(0, Math.min(100, discPct));

  let discAmt = 0;
  if (item.customDiscountAmount !== undefined && Number(item.customDiscountAmount) >= 0) {
    discAmt = Math.min(grossTotal, Number(item.customDiscountAmount));
    discPct = grossTotal > 0 ? Math.round((discAmt / grossTotal) * 1000) / 10 : 0;
  } else {
    discAmt = Math.round(((grossTotal * discPct) / 100) * 100) / 100;
  }

  const netTotal = Math.max(0, Math.round((grossTotal - discAmt) * 100) / 100);

  return {
    ...item,
    id: item.medicineId || `item-${Date.now()}-${index}`,
    isInfantMilk: isInfant,
    effectiveRate: mrp,
    quantity: qty,
    grossTotal,
    discountPercent: discPct,
    discountAmount: discAmt,
    netTotal,
  };
}

/**
 * Calculates complete bill summary with subtotals, roundoff, and savings
 */
export function calculateBillSummary(
  items: BillItemInput[],
  options: {
    invoiceNo?: string;
    customerName?: string;
    customerPhone?: string;
    customerVillage?: string;
    doctorName?: string;
    paymentMode?: 'cash' | 'upi' | 'credit';
    extraDiscount?: number; // Optional flat bill-level discount
  } = {}
): BillSummary {
  const calculatedItems = items.map((item, idx) => calculateLineItem(item, idx));

  let grossAmount = 0;
  let totalItemDiscount = 0;
  let totalQuantity = 0;

  for (const item of calculatedItems) {
    grossAmount += item.grossTotal;
    totalItemDiscount += item.discountAmount;
    totalQuantity += item.quantity;
  }

  grossAmount = Math.round(grossAmount * 100) / 100;
  totalItemDiscount = Math.round(totalItemDiscount * 100) / 100;

  const extraDiscount = Math.max(0, Number(options.extraDiscount) || 0);
  const totalDiscount = Math.min(grossAmount, Math.round((totalItemDiscount + extraDiscount) * 100) / 100);

  const exactNet = Math.max(0, grossAmount - totalDiscount);
  const netPayable = Math.round(exactNet); // Round to nearest ₹
  const roundOff = Math.round((netPayable - exactNet) * 100) / 100;

  const savingsPercent = grossAmount > 0 ? Math.round((totalDiscount / grossAmount) * 1000) / 10 : 0;

  return {
    invoiceNo: options.invoiceNo || generateInvoiceNumber(),
    date: new Date().toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    customerName: (options.customerName || 'Walk-in Customer').trim(),
    customerPhone: options.customerPhone ? String(options.customerPhone).replace(/[^0-9]/g, '').slice(-10) : undefined,
    customerVillage: options.customerVillage?.trim() || undefined,
    doctorName: options.doctorName?.trim() || undefined,
    paymentMode: options.paymentMode || 'cash',
    items: calculatedItems,
    totalItems: calculatedItems.length,
    totalQuantity,
    grossAmount,
    totalDiscount,
    extraDiscount,
    netPayable,
    roundOff,
    savingsPercent,
  };
}

/**
 * Generates an sequential or timestamp-based Invoice Number
 * Format: MMH-26-XXXXX
 */
export function generateInvoiceNumber(seed?: number | string): string {
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  if (seed !== undefined) {
    const num = String(seed).padStart(5, '0');
    return `MMH-${yearSuffix}-${num}`;
  }
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  return `MMH-${yearSuffix}-${randomSuffix}`;
}

/**
 * Generates an NPCI-compliant UPI payment deep link for QR codes and instant payment.
 * Formats amount to exactly 2 decimal places as per UPI specifications.
 */
export function generateUpiPaymentLink(
  amount: number | string,
  invoiceNo?: string,
  pharmacy: Partial<PharmacyDetails> = {}
): string {
  const cleanUpi = (pharmacy.upiId || 'manojmedical@okhdfcbank').trim();
  const payeeName = (pharmacy.upiPayeeName || pharmacy.name || 'Manoj Medical Hall').trim();
  const numAmount = typeof amount === 'string' ? parseFloat(amount) || 0 : Number(amount) || 0;
  const formattedAmount = numAmount.toFixed(2);
  const note = invoiceNo ? `Bill ${invoiceNo}` : 'Medicine Bill';
  return `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(payeeName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(note)}`;
}

/**
 * Generates a clean, friendly WhatsApp message for sharing bills with customers
 */
export function generateWhatsAppBillText(
  bill: BillSummary,
  pharmacy: PharmacyDetails = {
    name: 'Manoj Medical Hall',
    address: 'Sarfuddinpur, Muzaffarpur (843118)',
    phone: '9431422744',
    upiId: 'manojmedical@okhdfcbank',
    upiPayeeName: 'Manoj Medical Hall',
  }
): string {
  const cleanUpi = (pharmacy.upiId || 'manojmedical@okhdfcbank').trim();
  const upiLink = generateUpiPaymentLink(bill.netPayable, bill.invoiceNo, pharmacy);

  let msg = `🧾 *${pharmacy.name.toUpperCase()}*\n`;
  msg += `📍 ${pharmacy.address}\n`;
  if (pharmacy.phone) msg += `📞 Ph: ${pharmacy.phone}\n`;
  msg += `--------------------------------\n`;
  msg += `*Invoice No:* ${bill.invoiceNo}\n`;
  msg += `*Date:* ${bill.date}\n`;
  msg += `*Patient / Customer:* ${bill.customerName}${bill.customerVillage ? ` (${bill.customerVillage})` : ''}\n`;
  if (bill.doctorName) msg += `*Dr:* ${bill.doctorName}\n`;
  msg += `--------------------------------\n`;
  msg += `*ITEMS PURCHASED:*\n`;

  bill.items.forEach((item, idx) => {
    const discTag = item.discountPercent > 0 ? ` [${item.discountPercent}% Off]` : '';
    msg += `${idx + 1}. *${item.name}*\n`;
    msg += `   Qty: ${item.quantity} × MRP ₹${item.effectiveRate} = ₹${item.grossTotal}${discTag}\n`;
    if (item.discountAmount > 0) {
      msg += `   Net: *₹${item.netTotal}* (Saved ₹${item.discountAmount})\n`;
    }
  });

  msg += `--------------------------------\n`;
  msg += `Total MRP: ₹${bill.grossAmount.toFixed(2)}\n`;
  if (bill.totalDiscount > 0) {
    msg += `🎉 *Discount Saved: -₹${bill.totalDiscount.toFixed(2)} (${bill.savingsPercent}%)*\n`;
  }
  msg += `*NET AMOUNT PAYABLE: ₹${bill.netPayable}*\n`;
  msg += `Payment Mode: *${bill.paymentMode.toUpperCase()}*\n`;
  msg += `--------------------------------\n`;

  if (cleanUpi) {
    if (bill.paymentMode === 'upi' || bill.paymentMode === 'credit') {
      msg += `👉 *Tap here to pay instantly via UPI:*\n${upiLink}\n\n`;
    }
    msg += `💳 UPI ID: \`${cleanUpi}\`\n`;
  }

  msg += `🙏 धन्यवाद! Get Well Soon! / स्वस्थ रहें!`;
  return msg;
}
