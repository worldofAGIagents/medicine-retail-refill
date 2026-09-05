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

    let medicines: any[] = [];

    if (query) {
      const qLower = query.toLowerCase();
      // Fetch matching candidates up to 500
      const candidates = await db.medicine.findMany({
        where,
        take: 500,
      });

      // Relevance scoring
      const scoreMedicine = (m: any): number => {
        const nameLower = (m.name || '').toLowerCase();
        const words = nameLower.split(/[\s\-_\/]+/);

        // 1. Exact match
        if (nameLower === qLower) return 1000;
        // 2. Name starts with query (e.g. "TELVAS" starts with "tel")
        if (nameLower.startsWith(qLower)) return 900;
        // 3. Any word in name starts with query (e.g. "TAB TELVAS")
        if (words.some((w: string) => w.startsWith(qLower))) return 800;
        // 4. Name contains query
        if (nameLower.includes(qLower)) return 700;

        // 5. Generic / Salt starts with query
        const genLower = (m.genericName || '').toLowerCase();
        const saltLower = (m.saltComposition || '').toLowerCase();
        if (genLower.startsWith(qLower) || saltLower.startsWith(qLower)) return 600;
        // 6. Generic / Salt contains query
        if (genLower.includes(qLower) || saltLower.includes(qLower)) return 500;

        // 7. MARG item code starts with query
        const codeLower = (m.margItemCode || '').toLowerCase();
        if (codeLower.startsWith(qLower)) return 400;

        // 8. Manufacturer starts with query
        const mfgLower = (m.manufacturer || '').toLowerCase();
        if (mfgLower.startsWith(qLower)) return 300;

        return 100;
      };

      candidates.sort((a, b) => {
        const scoreA = scoreMedicine(a);
        const scoreB = scoreMedicine(b);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.name.localeCompare(b.name);
      });

      const startIndex = fetchAll ? 0 : (page - 1) * limit;
      medicines = fetchAll ? candidates : candidates.slice(startIndex, startIndex + limit);
    } else {
      medicines = await db.medicine.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: fetchAll ? undefined : (page - 1) * limit,
        take: fetchAll ? (limit ? limit : undefined) : limit,
      });
    }

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
