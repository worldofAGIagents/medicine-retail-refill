import { addDays, differenceInDays, isAfter, isBefore, startOfDay } from 'date-fns';

export interface RefillCalculation {
  nextRefillDate: Date;
  daysRemaining: number;
  urgency: 'overdue' | 'urgent' | 'due_soon' | 'ok' | 'future';
  totalTablets: number;
  daysOfSupply: number;
}

export function calculateRefill(params: {
  lastPurchaseDate: Date;
  lastPurchaseQty: number;
  dailyDosage: number;
  bufferDays?: number;
}): RefillCalculation {
  const { lastPurchaseDate, lastPurchaseQty, dailyDosage, bufferDays = 3 } = params;
  const daysOfSupply = Math.floor(lastPurchaseQty / dailyDosage);
  const medicineRunOutDate = addDays(lastPurchaseDate, daysOfSupply);
  const nextRefillDate = addDays(lastPurchaseDate, daysOfSupply - bufferDays);
  const today = startOfDay(new Date());
  const daysRemaining = differenceInDays(medicineRunOutDate, today);
  
  let urgency: RefillCalculation['urgency'];
  if (daysRemaining <= 0) urgency = 'overdue';
  else if (daysRemaining <= 2) urgency = 'urgent';
  else if (daysRemaining <= 5) urgency = 'due_soon';
  else if (daysRemaining <= 10) urgency = 'ok';
  else urgency = 'future';
  
  return { nextRefillDate, daysRemaining, urgency, totalTablets: lastPurchaseQty, daysOfSupply };
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
