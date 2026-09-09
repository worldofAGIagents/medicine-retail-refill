import { db } from '../src/lib/db';
import fs from 'fs';
import path from 'path';

async function migrate() {
  console.log('🚀 Starting migration to Supabase PostgreSQL...');

  const dumpPath = path.join(process.cwd(), 'scratch', 'sqlite_full_dump.json');
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Dump file not found at ${dumpPath}`);
  }

  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  console.log(`Loaded dump with:
    - ${dump.medicines.length} medicines
    - ${dump.settings.length} settings
    - ${dump.users.length} users
    - ${dump.customers.length} customers`);

  // 1. Migrate Pharmacy Settings
  console.log('\n--- 1. Migrating Pharmacy Settings ---');
  for (const s of dump.settings) {
    await db.pharmacySetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: {
        id: s.id,
        key: s.key,
        value: s.value,
      },
    });
  }
  console.log(`✅ Upserted ${dump.settings.length} pharmacy settings`);

  // 2. Migrate Users
  console.log('\n--- 2. Migrating Users ---');
  for (const u of dump.users) {
    await db.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        password: u.password,
        role: u.role,
      },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        password: u.password,
        role: u.role,
      },
    });
  }
  console.log(`✅ Upserted ${dump.users.length} users`);

  // 3. Migrate Customers & Prescriptions
  console.log('\n--- 3. Migrating Customers ---');
  for (const c of dump.customers) {
    await db.customer.upsert({
      where: { phone: c.phone },
      update: {
        name: c.name,
        primaryCondition: c.primaryCondition || 'Blood Pressure',
        address: c.address,
        locality: c.locality,
        city: c.city || 'Muzaffarpur',
        whatsappEnabled: c.whatsappEnabled ?? true,
      },
      create: {
        id: c.id,
        name: c.name,
        phone: c.phone,
        altPhone: c.altPhone,
        email: c.email,
        address: c.address,
        locality: c.locality,
        city: c.city || 'Muzaffarpur',
        whatsappEnabled: c.whatsappEnabled ?? true,
        consentGiven: c.consentGiven ?? false,
        primaryCondition: c.primaryCondition || 'Blood Pressure',
      },
    });
  }
  console.log(`✅ Upserted ${dump.customers.length} customers`);

  // 4. Migrate Medicines in batches
  console.log('\n--- 4. Migrating 9,259 Medicines ---');
  const batchSize = 250;
  let inserted = 0;
  let skipped = 0;

  // Let's get existing margItemCodes in Supabase to avoid conflict
  const existingMeds = await db.medicine.findMany({
    select: { margItemCode: true, name: true },
  });
  const existingCodes = new Set(existingMeds.map((m) => m.margItemCode).filter(Boolean));
  console.log(`Found ${existingMeds.length} existing medicines in Supabase`);

  const medsToInsert = dump.medicines.filter((m: any) => {
    if (m.margItemCode && existingCodes.has(m.margItemCode)) {
      return false;
    }
    return true;
  });

  console.log(`Found ${medsToInsert.length} new medicines to insert in batches of ${batchSize}...`);

  for (let i = 0; i < medsToInsert.length; i += batchSize) {
    const chunk = medsToInsert.slice(i, i + batchSize).map((m: any) => ({
      id: m.id,
      name: m.name,
      genericName: m.genericName || m.name,
      manufacturer: m.manufacturer || null,
      category: m.category || 'Blood Pressure',
      saltComposition: m.saltComposition || null,
      packagingType: m.packagingType || 'strip',
      unitsPerPack: Number(m.unitsPerPack) || 10,
      packsPerBox: Number(m.packsPerBox) || 1,
      mrp: Number(m.mrp) || 0,
      hsnCode: m.hsnCode || null,
      margItemCode: m.margItemCode || null,
      isChronicMed: Boolean(m.isChronicMed),
      currentStock: Number(m.currentStock) || 0,
      reorderLevel: Number(m.reorderLevel) || 50,
      createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
      updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
    }));

    try {
      const res = await db.medicine.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      inserted += res.count;
      process.stdout.write(`\rProgress: ${inserted + skipped}/${medsToInsert.length} (${(((inserted + skipped) / medsToInsert.length) * 100).toFixed(1)}%)`);
    } catch (e: any) {
      console.warn(`\nBatch starting at ${i} had issues, inserting individually:`, e.message);
      for (const item of chunk) {
        try {
          await db.medicine.upsert({
            where: item.margItemCode ? { margItemCode: item.margItemCode } : { id: item.id },
            update: item,
            create: item,
          });
          inserted++;
        } catch (itemErr: any) {
          skipped++;
        }
      }
    }
  }

  const finalTotal = await db.medicine.count();
  console.log(`\n\n🎉 Migration complete!`);
  console.log(`Final Supabase Medicine Count: ${finalTotal}`);
  console.log(`Final Supabase Settings Count: ${await db.pharmacySetting.count()}`);
  console.log(`Final Supabase Users Count: ${await db.user.count()}`);
  console.log(`Final Supabase Customers Count: ${await db.customer.count()}`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
