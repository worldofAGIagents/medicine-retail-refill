import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

import { DEFAULT_TEMPLATES } from '@/lib/templates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const rows = await db.pharmacySetting.findMany();
    const settings: Record<string, any> = {};
    for (const r of rows) {
      if (r.value === 'true') settings[r.key] = true;
      else if (r.value === 'false') settings[r.key] = false;
      else settings[r.key] = r.value;
    }

    // Default fallback values if empty
    const defaults = {
      pharmacyName: settings.pharmacyName || 'Manoj Medical Hall',
      dlNumber: settings.dlNumber || 'BR-20B/MUZ/2022',
      gstin: settings.gstin || '10AAAAA0000A1Z5',
      phone: settings.phone || '+91 98765 43210',
      address: settings.address || 'Sarfuddinpur, Gopalpur, Muzaffarpur, Bihar - 843118',
      city: settings.city || 'Muzaffarpur',
      state: settings.state || 'Bihar',
      pincode: settings.pincode || '843118',
      deliveryRadius: settings.deliveryRadius || '10-20 KM',
      deliveryCoverage: settings.deliveryCoverage || 'Sarfuddinpur, Gopalpur, Bochahan, Gaighat, Ladaura, Musahari & Nearby Villages',
      margApiUrl: settings.margApiUrl || 'https://api.margerp.com/v2',
      margCompanyCode: settings.margCompanyCode || 'MANOJ_MED_01',
      margBranchCode: settings.margBranchCode || 'HO',
      margSyncInterval: settings.margSyncInterval || '6',
      autoDetectChronic: settings.autoDetectChronic ?? true,
      defaultBufferDays: Number(settings.defaultBufferDays) || 3,
      reminderTime: settings.reminderTime || '09:00',
      whatsappEnabled: settings.whatsappEnabled ?? true,
      smsFallback: settings.smsFallback ?? true,
      preferredLanguage: settings.preferredLanguage || 'hindi',
      hindiTemplate: settings.hindiTemplate || DEFAULT_TEMPLATES.hindiTemplate,
      englishTemplate: settings.englishTemplate || DEFAULT_TEMPLATES.englishTemplate,
      infantMilkTemplate: settings.infantMilkTemplate || DEFAULT_TEMPLATES.infantMilkTemplate,
      overdueTemplate: settings.overdueTemplate || DEFAULT_TEMPLATES.overdueTemplate,
      outForDeliveryTemplate: settings.outForDeliveryTemplate || DEFAULT_TEMPLATES.outForDeliveryTemplate,
      upiId: process.env.SHOP_UPI_ID || settings.upiId || 'manojmedical@okhdfcbank',
      upiPayeeName: process.env.SHOP_UPI_PAYEE || settings.upiPayeeName || settings.pharmacyName || 'Manoj Medical Hall',
    };

    return NextResponse.json(defaults);
  } catch (error: any) {
    console.error('Failed to get settings:', error);
    return NextResponse.json({ error: 'Failed to retrieve settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return handleSaveSettings(request);
}

export async function POST(request: Request) {
  return handleSaveSettings(request);
}

async function handleSaveSettings(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid settings body' }, { status: 400 });
    }

    const updates: Promise<any>[] = [];
    for (const [key, val] of Object.entries(body)) {
      if (val === undefined || val === null) continue;
      const strVal = String(val).trim();
      updates.push(
        db.pharmacySetting.upsert({
          where: { key },
          update: { value: strVal },
          create: { key, value: strVal },
        })
      );
    }

    await Promise.all(updates);

    // Fetch and return fresh settings
    const rows = await db.pharmacySetting.findMany();
    const fresh: Record<string, any> = {};
    for (const r of rows) {
      fresh[r.key] = r.value;
    }

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: fresh,
    });
  } catch (error: any) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 });
  }
}
