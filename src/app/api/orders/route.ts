import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  
  const where = status ? { status } : {};
  const orders = await db.order.findMany({
    where,
    include: { customer: true, items: true },
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, ...orderData } = body;
    
    const order = await db.order.create({
      data: {
        ...orderData,
        items: {
          create: items
        }
      },
      include: { items: true }
    });
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating order' }, { status: 400 });
  }
}
