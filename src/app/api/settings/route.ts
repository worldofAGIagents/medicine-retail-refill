import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

import { DEFAULT_TEMPLATES } from '@/lib/templates';

export async function GET() {
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
      pharmacyName: settings.pharmacyName || 'MedRefill Chemist & Druggist',
      dlNumber: settings.dlNumber || 'DL-20B/12345/2022',
      gstin: settings.gstin || '07AAAAA0000A1Z5',
      phone: settings.phone || '+91 98765 43210',
      address: settings.address || 'Shop 14, Main Market, Sector 18, Noida, UP - 201301',
      margApiUrl: settings.margApiUrl || 'https://api.margerp.com/v2',
      margCompanyCode: settings.margCompanyCode || 'PHARMA_DELHI_01',
      margBranchCode: settings.margBranchCode || 'HO',
      margSyncInterval: settings.margSyncInterval || '6',
      autoDetectChronic: settings.autoDetectChronic ?? true,
      defaultBufferDays: Number(settings.defaultBufferDays) || 3,
      reminderTime: settings.reminderTime || '09:00',
      whatsappEnabled: settings.whatsappEnabled ?? true,
      smsFallback: settings.smsFallback ?? true,
      preferredLanguage: settings.preferredLanguage || DEFAULT_TEMPLATES.preferredLanguage,
      hindiTemplate: settings.hindiTemplate || DEFAULT_TEMPLATES.hindiTemplate,
      englishTemplate: settings.englishTemplate || DEFAULT_TEMPLATES.englishTemplate,
      infantMilkTemplate: settings.infantMilkTemplate || DEFAULT_TEMPLATES.infantMilkTemplate,
      overdueTemplate: settings.overdueTemplate || DEFAULT_TEMPLATES.overdueTemplate,
      outForDeliveryTemplate: settings.outForDeliveryTemplate || DEFAULT_TEMPLATES.outForDeliveryTemplate,
    };

    return NextResponse.json(defaults);
  } catch (error: any) {
    console.error('Failed to get settings:', error);
    return NextResponse.json({ error: 'Failed to retrieve settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const updates: Promise<any>[] = [];
    for (const [key, val] of Object.entries(body)) {
      const strVal = String(val);
      updates.push(
        db.pharmacySetting.upsert({
          where: { key },
          update: { value: strVal },
          create: { key, value: strVal },
        })
      );
    }

    await Promise.all(updates);

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error: any) {
    console.error('Failed to update settings:', error);
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 });
  }
}
