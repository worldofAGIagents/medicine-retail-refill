import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateRefill } from '@/lib/refill-engine';

export async function GET() {
  const prescriptions = await db.prescription.findMany({
    include: { customer: true, medicine: true },
    orderBy: { createdAt: 'desc' }
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
        category: p.medicine?.category,
        packagingType: p.medicine?.packagingType,
        unitType: p.unitType || undefined,
        customPackaging: p.customPackaging || undefined,
      });
    }
    return { ...p, refillStatus };
  });

  return NextResponse.json(formatted);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let nextRefillDate = body.nextRefillDate;
    
    if (!nextRefillDate && body.lastPurchaseDate && body.lastPurchaseQty) {
      let med = null;
      if (body.medicineId) {
        med = await db.medicine.findUnique({ where: { id: body.medicineId } });
      }
      const calc = calculateRefill({
        lastPurchaseDate: new Date(body.lastPurchaseDate),
        lastPurchaseQty: body.lastPurchaseQty,
        dailyDosage: body.dailyDosage,
        bufferDays: body.bufferDays || 3,
        medicineName: med?.name,
        category: med?.category,
        packagingType: med?.packagingType,
        unitType: body.unitType,
        customPackaging: body.customPackaging,
      });
      nextRefillDate = calc.nextRefillDate;
    }
    
    const prescription = await db.prescription.create({ 
      data: { ...body, nextRefillDate } 
    });
    return NextResponse.json(prescription, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating prescription' }, { status: 400 });
  }
}
