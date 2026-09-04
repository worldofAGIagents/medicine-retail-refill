import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const medicine = await db.medicine.findUnique({ where: { id: params.id } });
  if (!medicine) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(medicine);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const medicine = await db.medicine.update({ where: { id: params.id }, data: body });
    return NextResponse.json(medicine);
  } catch (error) {
    return NextResponse.json({ error: 'Error updating' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  await db.medicine.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
