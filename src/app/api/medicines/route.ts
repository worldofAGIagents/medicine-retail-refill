import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isChronic = searchParams.get('chronic');
  const category = searchParams.get('category');
  
  const where: any = {};
  if (isChronic === 'true') where.isChronicMed = true;
  if (category) where.category = category;
  
  const medicines = await db.medicine.findMany({ where, orderBy: { name: 'asc' } });
  return NextResponse.json(medicines);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const medicine = await db.medicine.create({ data: body });
    return NextResponse.json(medicine, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating medicine' }, { status: 400 });
  }
}
