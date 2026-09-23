import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateRefill } from '@/lib/refill-engine';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const prescription = await db.prescription.findUnique({
    where: { id: params.id },
    include: { customer: true, medicine: true, refillLogs: true }
  });
  if (!prescription) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(prescription);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const existing = await db.prescription.findUnique({
      where: { id: params.id },
      include: { medicine: true }
    });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const updateData: any = { ...body };
    if (updateData.dailyDosage !== undefined && updateData.dailyDosage !== null) {
      updateData.dailyDosage = Number(updateData.dailyDosage);
    }
    if (updateData.lastPurchaseQty !== undefined && updateData.lastPurchaseQty !== null) {
      updateData.lastPurchaseQty = Number(updateData.lastPurchaseQty);
    }
    if (updateData.bufferDays !== undefined && updateData.bufferDays !== null) {
      updateData.bufferDays = Number(updateData.bufferDays);
    }

    const effQty = updateData.lastPurchaseQty ?? existing.lastPurchaseQty;
    const effDosage = updateData.dailyDosage ?? existing.dailyDosage;
    const effBuffer = updateData.bufferDays ?? existing.bufferDays ?? 3;
    const effDate = updateData.lastPurchaseDate ? new Date(updateData.lastPurchaseDate) : (existing.lastPurchaseDate || new Date());

    if (effDate && effQty && effDosage && !updateData.nextRefillDate) {
      const calc = calculateRefill({
        lastPurchaseDate: new Date(effDate),
        lastPurchaseQty: effQty,
        dailyDosage: effDosage,
        bufferDays: effBuffer,
        medicineName: existing.medicine?.name,
        genericName: existing.medicine?.genericName,
        category: existing.medicine?.category,
        packagingType: existing.medicine?.packagingType,
        unitType: updateData.unitType || existing.unitType || undefined,
        customPackaging: updateData.customPackaging || existing.customPackaging || undefined,
      });
      updateData.nextRefillDate = calc.nextRefillDate;
    }

    const prescription = await db.prescription.update({ 
      where: { id: params.id }, 
      data: updateData,
      include: { medicine: true, customer: true }
    });
    return NextResponse.json(prescription);
  } catch (error: any) {
    console.error('Error updating prescription:', error);
    return NextResponse.json({ error: error.message || 'Error updating' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  await db.prescription.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
