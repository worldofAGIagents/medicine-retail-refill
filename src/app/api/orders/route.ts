import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const orderType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const orders = await db.order.findMany({
      where,
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Parse billing metadata from notes if present
    const formattedOrders = orders.map((ord) => {
      let meta: any = null;
      if (ord.notes && ord.notes.startsWith('{')) {
        try {
          meta = JSON.parse(ord.notes);
        } catch (_) {}
      }

      return {
        ...ord,
        invoiceNo: meta?.invoiceNo || `MMH-${ord.id.slice(-6).toUpperCase()}`,
        orderType: meta?.orderType || 'retail',
        grossAmount: meta?.grossAmount ?? ord.totalAmount,
        totalDiscount: meta?.totalDiscount ?? 0,
        roundOff: meta?.roundOff ?? 0,
        doctorName: meta?.doctorName,
        billingSnapshot: meta,
      };
    });

    const headers = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    };

    if (orderType && orderType !== 'all') {
      return NextResponse.json(formattedOrders.filter((o) => o.orderType === orderType), { headers });
    }

    return NextResponse.json(formattedOrders, { headers });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Error fetching orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customerId: inputCustomerId,
      customerName,
      customerPhone,
      customerVillage,
      doctorName,
      invoiceNo,
      orderType = 'retail',
      paymentMode = 'cash',
      paymentStatus,
      totalAmount,
      grossAmount,
      totalDiscount = 0,
      roundOff = 0,
      items = [],
      deliveryAddress,
      notes: rawNotes,
      billingSnapshot,
    } = body;

    let targetCustomerId = inputCustomerId;

    // 1. Resolve Customer:
    // If no customerId provided, either find/create by phone or use/create default Walk-in Customer
    if (!targetCustomerId) {
      const cleanPhone = customerPhone ? String(customerPhone).replace(/[^0-9]/g, '').slice(-10) : '';

      if (cleanPhone.length >= 10) {
        const existingCust = await db.customer.findUnique({ where: { phone: cleanPhone } });
        if (existingCust) {
          targetCustomerId = existingCust.id;
        } else {
          const newCust = await db.customer.create({
            data: {
              name: customerName?.trim() || `Customer (${cleanPhone.slice(-4)})`,
              phone: cleanPhone,
              address: customerVillage ? `गाँव: ${customerVillage.trim()}` : 'Walk-in Counter',
              locality: customerVillage || 'Sarfuddinpur',
              city: 'Muzaffarpur',
              primaryCondition: 'Blood Pressure',
            },
          });
          targetCustomerId = newCust.id;
        }
      } else {
        // Find or create default walk-in counter customer
        const walkinPhone = '9999999999';
        let walkinCust = await db.customer.findUnique({ where: { phone: walkinPhone } });
        if (!walkinCust) {
          walkinCust = await db.customer.create({
            data: {
              name: customerName?.trim() || 'Walk-in Customer (काउंटर)',
              phone: walkinPhone,
              address: customerVillage ? `गाँव: ${customerVillage.trim()}` : 'Store Counter Walk-in',
              locality: 'Sarfuddinpur',
              city: 'Muzaffarpur',
              primaryCondition: 'General Retail',
            },
          });
        }
        targetCustomerId = walkinCust.id;
      }
    }

    // 2. Prepare Order Metadata JSON for fail-safe retrieval & thermal printing
    const orderMetadata = {
      invoiceNo: invoiceNo || `MMH-${Date.now().toString().slice(-6)}`,
      orderType,
      grossAmount: Number(grossAmount) || Number(totalAmount) || 0,
      totalDiscount: Number(totalDiscount) || 0,
      roundOff: Number(roundOff) || 0,
      doctorName: doctorName || undefined,
      customerVillage: customerVillage || undefined,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      billingSnapshot: billingSnapshot || undefined,
      customNotes: rawNotes || undefined,
    };

    const isCredit = paymentMode === 'credit';
    const computedStatus = orderType === 'retail' ? 'delivered' : 'preparing';
    const computedPaymentStatus = paymentStatus || (isCredit ? 'pending' : 'collected');
    const computedAmountCollected = isCredit ? 0 : (Number(totalAmount) || 0);

    // 3. Create Order with Items in DB
    const order = await db.order.create({
      data: {
        customerId: targetCustomerId,
        totalAmount: Number(totalAmount) || 0,
        status: computedStatus,
        paymentMode: paymentMode,
        paymentStatus: computedPaymentStatus,
        amountCollected: computedAmountCollected,
        deliveryAddress: deliveryAddress || (customerVillage ? `गाँव: ${customerVillage}` : 'Store Counter'),
        notes: JSON.stringify(orderMetadata),
        items: {
          create: items.map((itm: any) => {
            const qty = Math.max(1, Number(itm.quantity) || 1);
            let unitPrice = Number(itm.unitPrice);
            if (isNaN(unitPrice) || unitPrice <= 0) {
              unitPrice = itm.netTotal ? Number(itm.netTotal) / qty : (Number(itm.mrp) || 0);
            }
            const totalPrice = Number(itm.totalPrice ?? itm.netTotal ?? (unitPrice * qty)) || 0;

            return {
              medicineName: itm.medicineName || itm.name || 'Medicine Item',
              medicineId: itm.medicineId || null,
              quantity: qty,
              unitPrice,
              totalPrice,
            };
          }),
        },
      },
      include: {
        customer: true,
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        invoiceNo: orderMetadata.invoiceNo,
        orderType: orderMetadata.orderType,
        grossAmount: orderMetadata.grossAmount,
        totalDiscount: orderMetadata.totalDiscount,
        billingSnapshot: orderMetadata,
      },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating order/bill:', error);
    return NextResponse.json({ error: error.message || 'Error creating order' }, { status: 400 });
  }
}
