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
        bufferDays: p.bufferDays
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
      const calc = calculateRefill({
        lastPurchaseDate: new Date(body.lastPurchaseDate),
        lastPurchaseQty: body.lastPurchaseQty,
        dailyDosage: body.dailyDosage,
        bufferDays: body.bufferDays || 3
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
