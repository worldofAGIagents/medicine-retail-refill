import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateRefill } from '@/lib/refill-engine';

export async function GET() {
  try {
    const totalCustomers = await db.customer.count();
    const activePrescriptionsCount = await db.prescription.count({ where: { isActive: true } });
    const pendingDeliveries = await db.order.count({ where: { status: { in: ['preparing', 'ready', 'out_for_delivery'] } } });

    // Calculate upcoming refills
    const prescriptions = await db.prescription.findMany({
      where: { isActive: true, lastPurchaseDate: { not: null }, lastPurchaseQty: { not: null } }
    });

    let upcomingRefillsCount = 0;
    for (const p of prescriptions) {
      if (p.lastPurchaseDate && p.lastPurchaseQty) {
        const { urgency } = calculateRefill({
          lastPurchaseDate: p.lastPurchaseDate,
          lastPurchaseQty: p.lastPurchaseQty,
          dailyDosage: p.dailyDosage,
          bufferDays: p.bufferDays
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
