import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const medicine = await db.medicine.findUnique({ where: { id: params.id } });
    if (!medicine) return NextResponse.json({ error: 'Medicine not found' }, { status: 404 });
    return NextResponse.json(medicine);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching medicine' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  return handleUpdate(request, params.id);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return handleUpdate(request, params.id);
}

async function handleUpdate(request: Request, id: string) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 });
    }

    const dataToUpdate: any = {};

    // Validate and sanitize fields
    if (body.mrp !== undefined) {
      const parsedMrp = parseFloat(body.mrp);
      if (isNaN(parsedMrp) || parsedMrp < 0) {
        return NextResponse.json({ error: 'MRP must be a positive number' }, { status: 400 });
      }
      dataToUpdate.mrp = parsedMrp;
    }

    if (body.unitsPerPack !== undefined) {
      const parsedUnits = parseInt(body.unitsPerPack, 10);
      if (!isNaN(parsedUnits) && parsedUnits > 0) {
        dataToUpdate.unitsPerPack = parsedUnits;
      }
    }

    if (body.packagingType !== undefined) {
      dataToUpdate.packagingType = String(body.packagingType).trim();
    }

    if (body.currentStock !== undefined) {
      const stock = parseInt(body.currentStock, 10);
      if (!isNaN(stock)) dataToUpdate.currentStock = stock;
    }

    if (body.reorderLevel !== undefined) {
      const lvl = parseInt(body.reorderLevel, 10);
      if (!isNaN(lvl)) dataToUpdate.reorderLevel = lvl;
    }

    if (body.category !== undefined) {
      dataToUpdate.category = String(body.category).trim();
    }

    if (body.name !== undefined) {
      dataToUpdate.name = String(body.name).trim();
    }

    if (body.genericName !== undefined) {
      dataToUpdate.genericName = String(body.genericName).trim();
    }

    if (body.manufacturer !== undefined) {
      dataToUpdate.manufacturer = String(body.manufacturer).trim();
    }

    const updated = await db.medicine.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating medicine:', error);
    return NextResponse.json({ error: error.message || 'Error updating medicine' }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await db.medicine.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error deleting medicine' }, { status: 400 });
  }
}
