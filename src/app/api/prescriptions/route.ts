import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateRefill } from '@/lib/refill-engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');
  const limit = parseInt(searchParams.get('limit') || '200', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const activeOnly = searchParams.get('active') !== 'false';

  const where: any = {};
  if (customerId) where.customerId = customerId;
  if (activeOnly) where.isActive = true;

  const prescriptions = await db.prescription.findMany({
    where,
    include: { customer: true, medicine: true },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 500),
    skip: offset,
  });
  
  const formatted = prescriptions.map(p => {
    let refillStatus = null;
    if (p.lastPurchaseDate && p.lastPurchaseQty) {
      refillStatus = calculateRefill({
        lastPurchaseDate: p.lastPurchaseDate,
        lastPurchaseQty: p.lastPurchaseQty,
        dailyDosage: p.dailyDosage,
        bufferDays: p.bufferDays,
        medicineName: p.medicine?.name,
        genericName: p.medicine?.genericName,
        category: p.medicine?.category,
        packagingType: p.medicine?.packagingType,
        unitType: p.unitType || undefined,
        customPackaging: p.customPackaging || undefined,
      });
    }
    return { ...p, refillStatus };
  });

  return NextResponse.json(formatted, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customerId,
      medicineId,
      dailyDosage = 1,
      lastPurchaseQty,
      quantity,
      lastPurchaseDate,
      dosageSchedule,
      doctorName,
      bufferDays = 3,
      customPackaging,
      packaging,
      unitType = 'tablets',
      isActive = true,
    } = body;

    if (!customerId || !medicineId) {
      return NextResponse.json({ error: 'customerId and medicineId are required' }, { status: 400 });
    }

    const effectiveQty = Number(lastPurchaseQty || quantity) || 30;
    const effectiveDosage = Number(dailyDosage) || 1;
    const effectivePackaging = customPackaging || packaging || '30 Tablets';
    const effectivePurchaseDate = lastPurchaseDate ? new Date(lastPurchaseDate) : new Date();

    let nextRefillDate = body.nextRefillDate;
    
    if (!nextRefillDate) {
      const med = await db.medicine.findUnique({ where: { id: medicineId } });
      const calc = calculateRefill({
        lastPurchaseDate: effectivePurchaseDate,
        lastPurchaseQty: effectiveQty,
        dailyDosage: effectiveDosage,
        bufferDays: Number(bufferDays) || 3,
        medicineName: med?.name,
        genericName: med?.genericName,
        category: med?.category,
        packagingType: med?.packagingType,
        unitType: unitType,
        customPackaging: effectivePackaging,
      });
      nextRefillDate = calc.nextRefillDate;
    }
    
    const prescription = await db.prescription.create({ 
      data: {
        customerId,
        medicineId,
        dailyDosage: effectiveDosage,
        lastPurchaseQty: effectiveQty,
        lastPurchaseDate: effectivePurchaseDate,
        nextRefillDate,
        bufferDays: Number(bufferDays) || 3,
        customPackaging: effectivePackaging,
        unitType: unitType || 'tablets',
        dosageSchedule: dosageSchedule || undefined,
        doctorName: doctorName || undefined,
        isActive: isActive !== false,
      },
      include: {
        medicine: true,
        customer: true,
      },
    });
    return NextResponse.json(prescription, { status: 201 });
  } catch (error: any) {
    console.error('Error creating prescription:', error);
    return NextResponse.json({ error: error.message || 'Error creating prescription' }, { status: 400 });
  }
}
