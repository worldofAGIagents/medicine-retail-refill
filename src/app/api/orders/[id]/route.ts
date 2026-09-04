import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const order = await db.order.findUnique({
    where: { id: params.id },
    include: { customer: true, items: true }
  });
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(order);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const order = await db.order.update({ where: { id: params.id }, data: body });
    return NextResponse.json(order);
  } catch (error) {
    return NextResponse.json({ error: 'Error updating' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  await db.order.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
