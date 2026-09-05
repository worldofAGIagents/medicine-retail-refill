import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CHRONIC_CATEGORIES: Record<string, RegExp> = {
  'Infant Milk': /\baptamil\b|\bsimilac\b|\bnan pro\b|\blactogen\b|\bdexolac\b|\bpediasure\b|\bfarex\b|\benfamil\b|\bnestogen\b/i,
  'Diabetes': /\bmetformin\b|\bglycomet\b|\bglimepiride\b|\bgliclazide\b|\bjanuvia\b|\bgalvus\b|\bteneligliptin\b|\bdapagliflozin\b|\bjardiance\b|\bforxiga\b|\blantus\b|\bryzodeg\b|\bmixtard\b|\bnovorapid\b|\bgemer\b|\bgluconorm\b|\bglybovin\b|\brepaglinide\b|\bvildagliptin\b|\bsitagliptin\b|\bpioglitazone\b|\btrajenta\b/i,
  'Blood Pressure': /\bamlodipine\b|\bamlo\b|\btelmisartan\b|\btelma\b|\blosartan\b|\bolmesartan\b|\bramipril\b|\benalapril\b|\batenolol\b|\bmetoprolol\b|\bcilnidipine\b|\bstarpress\b|\bbetaloc\b|\barkamin\b|\bnebivolol\b|\bcardivas\b|\bdiltiazem\b/i,
  'Thyroid': /\bthyronorm\b|\beltroxin\b|\bthyroxine\b|\blevothyroxine\b/i,
  'Cholesterol': /\batorvastatin\b|\batorva\b|\brosuvastatin\b|\brosuvas\b|\batorlip\b|\bstator\b|\bfenofibrate\b/i,
  'Heart': /\bclopidogrel\b|\bdeplatt\b|\bclopivas\b|\becosprin\b|\baspirin\b|\bsorbitrate\b|\bmonotrate\b|\bangispan\b|\bdigoxin\b|\bnicorandil\b/i,
  'Respiratory': /\bforacort\b|\bbudecort\b|\basthalin\b|\bseroflo\b|\bmontair\b|\btelekast\b|\bduolin\b|\bderiphyllin\b|\bmontek\b|\blevolin\b/i,
  'Gastric': /\bpantocid\b|\bpan-40\b|\bpantop\b|\bomez\b|\bomeprazole\b|\brabeprazole\b|\brabekind\b|\bcyra\b|\besomeprazole\b|\bnexpro\b|\bsompraz\b/i,
};

function detectCategoryAndChronic(name: string, salt: string): { category: string; isChronic: boolean } {
  const text = `${name} ${salt}`;
  for (const [cat, regex] of Object.entries(CHRONIC_CATEGORIES)) {
    if (regex.test(text)) {
      return { category: cat, isChronic: true };
    }
  }

  // Fallback categorization based on dosage form
  const upper = name.toUpperCase();
  if (upper.includes('TAB') || upper.includes('CAP')) return { category: 'Tablet / Capsule', isChronic: false };
  if (upper.includes('SYP') || upper.includes('SYRUP') || upper.includes('SUSP')) return { category: 'Syrup', isChronic: false };
  if (upper.includes('INJ') || upper.includes('VIAL') || upper.includes('AMP')) return { category: 'Injectable', isChronic: false };
  if (upper.includes('DROP') || upper.includes('DROPS')) return { category: 'Drops', isChronic: false };
  if (upper.includes('OINT') || upper.includes('CREAM') || upper.includes('GEL')) return { category: 'Topical', isChronic: false };

  return { category: 'General', isChronic: false };
}

function parsePackaging(name: string, isInfantMilk: boolean): { unitsPerPack: number; packagingType: string } {
  const upper = name.toUpperCase();

  if (isInfantMilk || upper.includes('400G') || upper.includes('400 GM')) {
    return { unitsPerPack: 400, packagingType: 'tin' };
  }
  if (upper.includes('1KG') || upper.includes('1000G')) {
    return { unitsPerPack: 1000, packagingType: 'tin' };
  }
  if (upper.includes('1X10') || upper.includes('10TAB') || upper.includes("10'S")) {
    return { unitsPerPack: 10, packagingType: 'strip' };
  }
  if (upper.includes('1X15') || upper.includes('15TAB') || upper.includes("15'S")) {
    return { unitsPerPack: 15, packagingType: 'strip' };
  }
  if (upper.includes('1X30') || upper.includes('30TAB') || upper.includes("30'S")) {
    return { unitsPerPack: 30, packagingType: 'bottle' };
  }
  if (upper.includes('1X20') || upper.includes("20'S")) {
    return { unitsPerPack: 20, packagingType: 'strip' };
  }
  if (upper.includes('1X6') || upper.includes('6TAB')) {
    return { unitsPerPack: 6, packagingType: 'strip' };
  }
  if (upper.includes('SYP') || upper.includes('SYRUP') || upper.includes('DROP') || upper.includes('SUSP')) {
    return { unitsPerPack: 1, packagingType: 'bottle' };
  }

  return { unitsPerPack: 10, packagingType: 'strip' };
}

async function main() {
  const filePath = path.resolve('/Users/shivanshuraj/Downloads/STOCKDATAFUL.xlsx');
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  console.log('Reading Excel file:', filePath);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

  console.log(`Found ${rows.length} records in sheet "${sheetName}".`);

  let upsertedCount = 0;
  let chronicCount = 0;

  // Process in batches of 200 for fast database writes
  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);

    const operations = chunk.map((row) => {
      const margItemCode = String(row.ItemCode || row.ITEM_CODE || row.Item_Code || '').trim();
      const rawName = String(row.Name || row.ITEM_NAME || '').trim();
      if (!rawName || !margItemCode) return null;

      const manufacturer = String(row.Company || row.COMPANY || '').trim() || 'Indian Pharma';
      const saltComposition = String(row.Salt || row.SALT || '').trim() || null;
      const hsnCode = row.HSNCode ? String(row.HSNCode).trim() : null;
      const mrp = parseFloat(String(row['M.R.P.'] || row.MRP || row.Rate || '0')) || 0;
      const currentStock = Math.max(0, parseInt(String(row.Stock || '0'), 10) || 0);

      const { category, isChronic } = detectCategoryAndChronic(rawName, saltComposition || '');
      const { unitsPerPack, packagingType } = parsePackaging(rawName, category === 'Infant Milk');

      if (isChronic) chronicCount++;

      return prisma.medicine.upsert({
        where: { margItemCode },
        update: {
          name: rawName,
          genericName: saltComposition || rawName,
          manufacturer,
          category,
          saltComposition,
          packagingType,
          unitsPerPack,
          mrp,
          hsnCode,
          isChronicMed: isChronic,
          currentStock,
          reorderLevel: 20,
        },
        create: {
          margItemCode,
          name: rawName,
          genericName: saltComposition || rawName,
          manufacturer,
          category,
          saltComposition,
          packagingType,
          unitsPerPack,
          packsPerBox: 10,
          mrp,
          hsnCode,
          isChronicMed: isChronic,
          currentStock,
          reorderLevel: 20,
        },
      });
    }).filter(Boolean);

    if (operations.length > 0) {
      await prisma.$transaction(operations as any);
      upsertedCount += operations.length;
      if (upsertedCount % 1000 === 0 || upsertedCount === rows.length) {
        console.log(`Progress: ${upsertedCount}/${rows.length} products ingested...`);
      }
    }
  }

  const finalCount = await prisma.medicine.count();
  console.log(`\n🎉 Ingestion Complete!`);
  console.log(`Total rows processed: ${upsertedCount}`);
  console.log(`Chronic refill medicines identified: ${chronicCount}`);
  console.log(`Total medicines now in database: ${finalCount}`);
}

main()
  .catch((e) => {
    console.error('Ingestion failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
