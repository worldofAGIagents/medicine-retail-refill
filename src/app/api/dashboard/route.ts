import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateRefill } from '@/lib/refill-engine';
import { detectMedicineFormFactor } from '@/lib/medicine-classifier';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const totalCustomers = await db.customer.count();
    const pendingDeliveries = await db.order.count({
      where: { status: { in: ['preparing', 'ready', 'out_for_delivery'] } },
    });

    // 1. Fetch active prescriptions
    const rawPrescriptions = await db.prescription.findMany({
      where: { isActive: true },
      include: {
        medicine: true,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            locality: true,
            address: true,
            primaryCondition: true,
          },
        },
      },
    });

    // Deduplicate
    const seenPresc = new Set<string>();
    const prescriptions = rawPrescriptions.filter((p) => {
      const key = `${p.customerId}::${p.medicineId}`;
      if (seenPresc.has(key)) return false;
      seenPresc.add(key);
      return true;
    });

    const activePrescriptionsCount = prescriptions.length;

    // Refill urgency breakdown
    let overdueCount = 0;
    let urgentCount = 0; // 1-2 days
    let dueSoonCount = 0; // 3-7 days
    let futureCount = 0;

    // Form factor & condition breakdown
    const formFactorCounts: Record<string, number> = {
      tablet: 0,
      insulin: 0,
      syrup: 0,
      inhaler: 0,
      drops: 0,
      infant_milk: 0,
    };

    const conditionCounts: Record<string, number> = {};
    const medicineRepeatMap: Record<string, { name: string; count: number; category: string }> = {};

    for (const p of prescriptions) {
      // Condition count
      const cond = p.customer?.primaryCondition || p.medicine?.category || 'Blood Pressure';
      conditionCounts[cond] = (conditionCounts[cond] || 0) + 1;

      // Repeat medicine ranking
      const medName = p.medicine?.name || 'Unknown';
      if (!medicineRepeatMap[medName]) {
        medicineRepeatMap[medName] = {
          name: medName,
          count: 0,
          category: p.medicine?.category || cond,
        };
      }
      medicineRepeatMap[medName].count++;

      // Form factor detection
      const ff = detectMedicineFormFactor({
        name: p.medicine?.name,
        genericName: p.medicine?.genericName,
        category: p.medicine?.category,
        packagingType: p.medicine?.packagingType,
        unitType: p.unitType,
        customPackaging: p.customPackaging,
      });
      formFactorCounts[ff] = (formFactorCounts[ff] || 0) + 1;

      // Refill math
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

        if (urgency === 'overdue') overdueCount++;
        else if (urgency === 'urgent') urgentCount++;
        else if (urgency === 'due_soon') dueSoonCount++;
        else futureCount++;
      }
    }

    const upcomingRefillsCount = overdueCount + urgentCount + dueSoonCount;

    // Top 5 repeat medicines
    const topMedicines = Object.values(medicineRepeatMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 2. Fetch today's sales metrics & recent orders
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayOrders = await db.order.findMany({
      where: {
        createdAt: { gte: startOfToday },
      },
      select: {
        totalAmount: true,
        paymentMode: true,
        notes: true,
      },
    });

    let todayTotalRevenue = 0;
    let todayCashRevenue = 0;
    let todayUpiRevenue = 0;

    for (const ord of todayOrders) {
      const amt = Number(ord.totalAmount) || 0;
      todayTotalRevenue += amt;
      const pm = (ord.paymentMode || '').toLowerCase();
      if (pm === 'upi' || pm === 'online') {
        todayUpiRevenue += amt;
      } else {
        todayCashRevenue += amt;
      }
    }

    // Recent 6 orders
    const recentOrdersRaw = await db.order.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { name: true, phone: true, locality: true } },
      },
    });

    const recentOrders = recentOrdersRaw.map((ord) => {
      let meta: any = null;
      if (ord.notes && ord.notes.startsWith('{')) {
        try {
          meta = JSON.parse(ord.notes);
        } catch (_) {}
      }
      return {
        id: ord.id,
        invoiceNo: meta?.invoiceNo || `MMH-${ord.id.slice(-6).toUpperCase()}`,
        customerName: ord.customer?.name || meta?.customerName || 'Walk-in Customer',
        customerPhone: ord.customer?.phone || meta?.customerPhone || '',
        customerVillage: ord.customer?.locality || meta?.customerVillage || 'Sarfuddinpur',
        totalAmount: Number(ord.totalAmount) || 0,
        paymentMethod: ord.paymentMode || 'cash',
        status: ord.status,
        createdAt: ord.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      totalCustomers,
      upcomingRefills: upcomingRefillsCount,
      upcomingRefillsCount,
      activePrescriptions: activePrescriptionsCount,
      activePrescriptionsCount,
      pendingDeliveries,
      refillMetrics: {
        overdue: overdueCount,
        urgent: urgentCount,
        dueSoon: dueSoonCount,
        future: futureCount,
      },
      todaySales: {
        ordersCount: todayOrders.length,
        totalRevenue: Math.round(todayTotalRevenue * 100) / 100,
        cashRevenue: Math.round(todayCashRevenue * 100) / 100,
        upiRevenue: Math.round(todayUpiRevenue * 100) / 100,
      },
      conditionDistribution: conditionCounts,
      formFactorDistribution: formFactorCounts,
      topMedicines,
      recentOrders,
    });
  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
