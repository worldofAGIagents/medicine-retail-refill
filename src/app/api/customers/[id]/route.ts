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
    const { name, phone, altPhone, address, locality, city, primaryCondition } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const customer = await db.customer.update({
      where: { id: params.id },
      data: {
        name,
        phone: cleanPhone,
        altPhone: altPhone ? String(altPhone).replace(/[^0-9]/g, '').slice(-10) : null,
        address,
        locality,
        city,
        primaryCondition,
      },
      include: { prescriptions: { include: { medicine: true } } }
    });
    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Error updating' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  await db.customer.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
