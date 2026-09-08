import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateRefill } from '@/lib/refill-engine';

export async function GET() {
  try {
    const totalCustomers = await db.customer.count();
    const pendingDeliveries = await db.order.count({ where: { status: { in: ['preparing', 'ready', 'out_for_delivery'] } } });

    // Calculate upcoming refills with deduplication
    const rawPrescriptions = await db.prescription.findMany({
      where: { isActive: true, lastPurchaseDate: { not: null }, lastPurchaseQty: { not: null } },
      include: { medicine: true }
    });

    const seenPresc = new Set<string>();
    const prescriptions = rawPrescriptions.filter(p => {
      const key = `${p.customerId}::${p.medicineId}`;
      if (seenPresc.has(key)) return false;
      seenPresc.add(key);
      return true;
    });

    const activePrescriptionsCount = prescriptions.length;

    let upcomingRefillsCount = 0;
    for (const p of prescriptions) {
      if (p.lastPurchaseDate && p.lastPurchaseQty) {
        const { urgency } = calculateRefill({
          lastPurchaseDate: p.lastPurchaseDate,
          lastPurchaseQty: p.lastPurchaseQty,
          dailyDosage: p.dailyDosage,
          bufferDays: p.bufferDays,
          medicineName: p.medicine?.name,
          category: p.medicine?.category,
          packagingType: p.medicine?.packagingType,
          unitType: p.unitType || undefined,
          customPackaging: p.customPackaging || undefined,
        });
        if (['overdue', 'urgent', 'due_soon'].includes(urgency)) {
          upcomingRefillsCount++;
        }
      }
    }

    return NextResponse.json({
      totalCustomers,
      upcomingRefills: upcomingRefillsCount,
      upcomingRefillsCount,
      activePrescriptions: activePrescriptionsCount,
      activePrescriptionsCount,
      pendingDeliveries
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
