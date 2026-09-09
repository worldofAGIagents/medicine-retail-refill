import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  
  const customers = await db.customer.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { address: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {},
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

  const sanitized = customers.map((c) => {
    const seenMed = new Set<string>();
    const dedupedPrescriptions = c.prescriptions.filter((p) => {
      const medKey = p.medicineId || p.medicine?.name;
      if (!medKey || seenMed.has(medKey)) return false;
      seenMed.add(medKey);
      return true;
    });
    return {
      ...c,
      prescriptions: dedupedPrescriptions,
    };
  });

  return NextResponse.json(sanitized, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
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
