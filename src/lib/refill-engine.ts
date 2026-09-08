import { addDays, differenceInDays, isAfter, isBefore, startOfDay } from 'date-fns';

export interface RefillCalculation {
  nextRefillDate: Date;
  daysRemaining: number;
  urgency: 'overdue' | 'urgent' | 'due_soon' | 'ok' | 'future';
  totalTablets: number;
  daysOfSupply: number;
  isSyrup?: boolean;
}

/**
 * Detect whether a medication is a liquid syrup / suspension / drops.
 */
export function isSyrupMedicine(medicine?: {
  name?: string | null;
  genericName?: string | null;
  category?: string | null;
  packagingType?: string | null;
  unitType?: string | null;
  customPackaging?: string | null;
} | null): boolean {
  if (!medicine) return false;
  const name = (medicine.name || '').toLowerCase();
  const generic = (medicine.genericName || '').toLowerCase();
  const category = (medicine.category || '').toLowerCase();
  const packaging = (medicine.packagingType || '').toLowerCase();
  const unit = (medicine.unitType || '').toLowerCase();
  const customPack = (medicine.customPackaging || '').toLowerCase();

  // 1. Explicit category
  if (category === 'syrup' || category === 'drops' || category === 'suspension') return true;

  // 2. Clear syrup / liquid / suspension keywords in name or generic or custom packaging
  const syrupPattern = /\b(syp|syrup|susp|suspension|drops?|elixir|solution|liquid|linctus|tonic|(oral|mouth)\s+(gel|paint)|pediatric\s+drop)\b/i;
  if (syrupPattern.test(name) || syrupPattern.test(generic) || syrupPattern.test(customPack)) {
    return true;
  }

  // 3. Unit type 'ml' is always liquid syrup
  if (unit === 'ml' || unit === 'bottle' || unit === 'bottles') {
    return true;
  }

  // 4. If packaging is bottle and not marked as a tablet/capsule bottle (e.g. 30 tabs in bottle)
  if (packaging === 'bottle' || customPack.includes('bottle') || customPack.includes('ml')) {
    const isExplicitTablet = /\b(tab|tabs|tablet|tablets|cap|caps|capsule|capsules)\b/i.test(name) && !syrupPattern.test(name);
    if (!isExplicitTablet) return true;
  }

  return false;
}

export function calculateRefill(params: {
  lastPurchaseDate: Date;
  lastPurchaseQty: number;
  dailyDosage: number;
  bufferDays?: number;
  medicineName?: string;
  category?: string;
  packagingType?: string;
  unitType?: string;
  customPackaging?: string;
  isSyrup?: boolean;
}): RefillCalculation {
  const {
    lastPurchaseDate,
    lastPurchaseQty,
    dailyDosage,
    bufferDays = 3,
    medicineName,
    category,
    packagingType,
    unitType,
    customPackaging,
  } = params;

  // Detect whether this item is a syrup
  const isSyrup =
    params.isSyrup ??
    isSyrupMedicine({
      name: medicineName,
      category,
      packagingType,
      unitType,
      customPackaging,
    });

  const today = startOfDay(new Date());

  // FOR SYRUP: Refill is scheduled for the NEXT DAY relative to purchase date
  if (isSyrup) {
    const nextRefillDate = addDays(startOfDay(lastPurchaseDate), 1);
    const daysRemaining = differenceInDays(nextRefillDate, today);

    let urgency: RefillCalculation['urgency'];
    if (daysRemaining <= 0) urgency = 'overdue';
    else if (daysRemaining === 1) urgency = 'urgent'; // Due tomorrow (Next Day)
    else urgency = 'due_soon';

    return {
      nextRefillDate,
      daysRemaining,
      urgency,
      totalTablets: lastPurchaseQty,
      daysOfSupply: 1,
      isSyrup: true,
    };
  }

  // STANDARD TABLET / CHRONIC CALCULATION
  const safeDailyDosage = dailyDosage > 0 ? dailyDosage : 1;
  const daysOfSupply = Math.floor(lastPurchaseQty / safeDailyDosage);
  const medicineRunOutDate = addDays(lastPurchaseDate, daysOfSupply);
  const nextRefillDate = addDays(lastPurchaseDate, Math.max(1, daysOfSupply - bufferDays));
  const daysRemaining = differenceInDays(medicineRunOutDate, today);
  
  let urgency: RefillCalculation['urgency'];
  if (daysRemaining <= 0) urgency = 'overdue';
  else if (daysRemaining <= 2) urgency = 'urgent';
  else if (daysRemaining <= 5) urgency = 'due_soon';
  else if (daysRemaining <= 10) urgency = 'ok';
  else urgency = 'future';
  
  return { nextRefillDate, daysRemaining, urgency, totalTablets: lastPurchaseQty, daysOfSupply, isSyrup: false };
}

export function getUrgencyColor(urgency: RefillCalculation['urgency']): string {
  switch (urgency) {
    case 'overdue': return '#EF4444';
    case 'urgent': return '#EF4444';
    case 'due_soon': return '#F59E0B';
    case 'ok': return '#22C55E';
    case 'future': return '#94A3B8';
  }
}

export function getUrgencyLabel(urgency: RefillCalculation['urgency']): string {
  switch (urgency) {
    case 'overdue': return 'Overdue';
    case 'urgent': return 'Urgent';
    case 'due_soon': return 'Due Soon';
    case 'ok': return 'OK';
    case 'future': return 'Future';
  }
}
