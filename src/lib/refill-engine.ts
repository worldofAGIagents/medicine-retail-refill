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
  const name = (medicine.name || '').trim().toLowerCase();
  const generic = (medicine.genericName || '').trim().toLowerCase();
  const category = (medicine.category || '').trim().toLowerCase();
  const packaging = (medicine.packagingType || '').trim().toLowerCase();
  const unit = (medicine.unitType || '').trim().toLowerCase();
  const customPack = (medicine.customPackaging || '').trim().toLowerCase();

  // If completely empty object
  if (!name && !generic && !category && !packaging && !unit && !customPack) {
    return false;
  }

  // 1. Infant Milk Formula is NOT a syrup
  if (
    category.includes('milk') ||
    category.includes('infant') ||
    name.includes('infant milk') ||
    generic.includes('infant formula')
  ) {
    return false;
  }

  // 2. Clear syrup / liquid / suspension keywords in name, generic, category, or custom packaging
  // Covers: liquid syrups, cough formulas, suspensions, drops, elixirs, tonics, pediatric drops, oral gels, solutions
  const syrupPattern = /\b(syp|syrup|syrups|susp|suspension|suspensions|drops?|elixir|elixirs|solutions?|liquid|liquids|linctus|tonic|tonics|cough\s+formula|(oral|mouth)\s+(gel|paint)s?|pediatric\s+drops?)\b/i;

  const hasSyrupKeyword =
    syrupPattern.test(name) ||
    syrupPattern.test(generic) ||
    syrupPattern.test(category) ||
    syrupPattern.test(customPack);

  // 3. Tablet / capsule detection:
  // Bottles of tablets/capsules (e.g. 'ACITROM 4MG TAB 1X30', 'THYRONORM 50MCG TAB 1X120', 'SHELCAL 500 TAB')
  // must NOT be classified as syrup even if packagingType is bottle or unitType is bottle.
  const tabletPattern = /\b(tab|tabs|tablet|tablets|cap|caps|capsule|capsules)\b/i;
  const isExplicitTablet =
    !hasSyrupKeyword &&
    (tabletPattern.test(name) ||
      tabletPattern.test(generic) ||
      tabletPattern.test(customPack) ||
      category === 'tablet' ||
      category === 'tablets' ||
      category === 'capsule' ||
      category === 'capsules' ||
      unit === 'tab' ||
      unit === 'tabs' ||
      unit === 'tablet' ||
      unit === 'tablets' ||
      unit === 'cap' ||
      unit === 'caps');

  if (isExplicitTablet) {
    return false;
  }

  // If any syrup keyword was found, it is a syrup
  if (hasSyrupKeyword) {
    return true;
  }

  // 4. Explicit categories
  if (category === 'syrup' || category === 'drops' || category === 'suspension') {
    return true;
  }

  // 5. Unit type 'ml' is always liquid syrup
  if (unit === 'ml' || customPack.includes('ml')) {
    return true;
  }

  // 6. Bottle packaging (if not an explicit tablet/capsule)
  if (
    packaging === 'bottle' ||
    packaging.includes('bottle') ||
    customPack.includes('bottle') ||
    unit === 'bottle' ||
    unit === 'bottles'
  ) {
    return true;
  }

  return false;
}

export function calculateRefill(params: {
  lastPurchaseDate: Date;
  lastPurchaseQty: number;
  dailyDosage: number;
  bufferDays?: number;
  medicineName?: string;
  genericName?: string;
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
    genericName,
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
      genericName,
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
