import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateRefill } from '@/lib/refill-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const prescriptions = await db.prescription.findMany({
    where: { isActive: true, lastPurchaseDate: { not: null }, lastPurchaseQty: { not: null } },
    include: { customer: true, medicine: true },
    orderBy: { updatedAt: 'desc' },
  });

  // Deduplicate by customerId + medicineId to guarantee zero duplicate refill entries
  const seenMap = new Map<string, (typeof prescriptions)[0]>();
  for (const p of prescriptions) {
    const key = `${p.customerId}-${p.medicineId}`;
    if (!seenMap.has(key)) {
      seenMap.set(key, p);
    }
  }
  const uniquePrescriptions = Array.from(seenMap.values());

  const refills = uniquePrescriptions.map(p => {
    const calc = calculateRefill({
      lastPurchaseDate: p.lastPurchaseDate!,
      lastPurchaseQty: p.lastPurchaseQty!,
      dailyDosage: p.dailyDosage,
      bufferDays: p.bufferDays
    });
    return { ...p, refillCalc: calc };
  }).sort((a, b) => a.refillCalc.daysRemaining - b.refillCalc.daysRemaining);

  return NextResponse.json(refills);
}

export async function POST(request: Request) {
  try {
    const { prescriptionId, quantity, date } = await request.json();
    const pDate = new Date(date || Date.now());
    
    const prescription = await db.prescription.findUnique({ where: { id: prescriptionId } });
    if (!prescription) return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });

    const calc = calculateRefill({
      lastPurchaseDate: pDate,
      lastPurchaseQty: quantity,
      dailyDosage: prescription.dailyDosage,
      bufferDays: prescription.bufferDays
    });

    const updated = await db.prescription.update({
      where: { id: prescriptionId },
      data: {
        lastPurchaseDate: pDate,
        lastPurchaseQty: quantity,
        nextRefillDate: calc.nextRefillDate
      }
    });

    await db.refillLog.create({
      data: {
        prescriptionId,
        quantity,
        status: 'delivered',
        deliveredAt: pDate
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Error recording refill' }, { status: 400 });
  }
}
