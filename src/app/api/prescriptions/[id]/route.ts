import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    const prescription = await db.prescription.update({ where: { id: params.id }, data: body });
    return NextResponse.json(prescription);
  } catch (error) {
    return NextResponse.json({ error: 'Error updating' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  await db.prescription.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
