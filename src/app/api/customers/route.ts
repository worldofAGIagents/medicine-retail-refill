import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  
  const customers = await db.customer.findMany({
    where: {
      OR: [
        { name: { contains: search } },
        { phone: { contains: search } },
        { address: { contains: search } },
        { city: { contains: search } }
      ]
    },
    include: {
      prescriptions: {
        where: { isActive: true },
        include: { medicine: true }
      },
      orders: {
        take: 3,
        orderBy: { createdAt: 'desc' }
      }
    },
    take: 100,
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customer = await db.customer.create({ data: body });
    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error creating customer' }, { status: 400 });
  }
}
