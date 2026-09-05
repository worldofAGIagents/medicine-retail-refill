import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || searchParams.get('search') || '').trim();
    const isChronic = searchParams.get('chronic');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1', 10) || 1;
    const limit = parseInt(searchParams.get('limit') || '50', 10) || 50;
    const format = searchParams.get('format');
    const fetchAll = searchParams.get('all') === 'true';
    
    const where: any = {};
    if (isChronic === 'true') where.isChronicMed = true;
    if (category && category !== 'All') {
      if (category.toLowerCase() === 'bp') {
        where.OR = [
          { category: { contains: 'BP' } },
          { category: { contains: 'Blood Pressure' } }
        ];
      } else {
        where.category = { contains: category };
      }
    }

    if (query) {
      const searchConditions = [
        { name: { contains: query } },
        { genericName: { contains: query } },
        { manufacturer: { contains: query } },
        { margItemCode: { contains: query } },
        { saltComposition: { contains: query } },
      ];

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const total = await db.medicine.count({ where });

    const medicines = await db.medicine.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: fetchAll ? undefined : (page - 1) * limit,
      take: fetchAll ? (limit ? limit : undefined) : limit,
    });

    if (format === 'array') {
      return NextResponse.json(medicines);
    }

    return NextResponse.json({
      data: medicines,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error: any) {
    console.error('Error fetching medicines:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch medicines' }, { status: 500 });
  }
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
