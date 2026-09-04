import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const customer = await db.customer.findUnique({
    where: { id: params.id },
    include: { prescriptions: { include: { medicine: true } }, orders: true }
  });
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(customer);
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const customer = await db.customer.update({ where: { id: params.id }, data: body });
    return NextResponse.json(customer);
  } catch (error) {
    return NextResponse.json({ error: 'Error updating' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  await db.customer.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
