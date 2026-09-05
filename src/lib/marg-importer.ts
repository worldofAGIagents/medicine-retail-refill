import Papa from 'papaparse';
import { db } from './db';

const CHRONIC_KEYWORDS = [
  'Metformin', 'Glimepiride', 'Gliclazide', 'Amlodipine', 'Telmisartan', 'Losartan', 
  'Atorvastatin', 'Rosuvastatin', 'Thyroxine', 'Levothyroxine', 'Enalapril', 
  'Ramipril', 'Olmesartan', 'Valsartan', 'Sitagliptin', 'Vildagliptin', 
  'Pioglitazone', 'Insulin', 'Teneligliptin', 'Dapagliflozin', 'Empagliflozin',
  'Nan Pro', 'Lactogen', 'Similac', 'Aptamil', 'Dexolac', 'Infant Formula', 'Infant Milk', 'Pediasure'
];

export async function parseMargCSV(input: string | any[], importType: string = 'medicines') {
  let records: any[] = [];
  if (Array.isArray(input)) {
    records = input;
  } else {
    const result = Papa.parse(input, {
      header: true,
      skipEmptyLines: true,
    });
    records = result.data as any[];
  }
  
  const importedCount = { medicines: 0, customers: 0, prescriptions: 0 };
  
  for (const row of records) {
    if (importType === 'medicines' || importType === 'stock' || !importType) {
      const name = row.Name || row.ITEM_NAME || row.name || row['Item Name'] || row.item_name || '';
      if (!name) continue;

      const margItemCode = String(row.ItemCode || row.ITEM_CODE || row.Code || row.code || row.item_code || `MARG-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30).toUpperCase()}`).trim();
      const isInfantMilk = /nan pro|lactogen|similac|aptamil|dexolac|infant milk|infant formula|pediasure/i.test(`${name} ${row.SALT || row.Salt || ''}`);
      const genericName = row.Salt || row.SALT || row.Generic || row.genericName || row['Generic Name'] || (isInfantMilk ? 'Infant Milk Formula' : name);
      
      let category = row.Category || row.CATEGORY || row.category || '';
      if (!category) {
        const checkStr = `${name} ${genericName}`.toLowerCase();
        if (isInfantMilk) category = 'Infant Milk';
        else if (/metformin|glycomet|glimepiride|gliclazide|januvia|galvus|dapagliflozin/i.test(checkStr)) category = 'Diabetes';
        else if (/amlodipine|amlo|telmisartan|telma|losartan|olmesartan|ramipril/i.test(checkStr)) category = 'Blood Pressure';
        else if (/thyronorm|eltroxin|thyroxine/i.test(checkStr)) category = 'Thyroid';
        else if (/atorvastatin|atorva|rosuvastatin|rosuvas/i.test(checkStr)) category = 'Cholesterol';
        else if (/foracort|budecort|asthalin|seroflo|montair/i.test(checkStr)) category = 'Respiratory';
        else if (/pantocid|pan-40|pantop|omez|rabeprazole/i.test(checkStr)) category = 'Gastric';
        else if (/tab|cap/i.test(name)) category = 'Tablet / Capsule';
        else if (/syp|syrup|susp/i.test(name)) category = 'Syrup';
        else category = 'General';
      }
      
      const saltComposition = row.Salt || row.SALT || genericName;

      let packagingType = 'strip';
      if (isInfantMilk || /400\s*g|tin|jar/i.test(name)) packagingType = 'tin';
      else if (/bottle|syp|syrup|drop/i.test(name)) packagingType = 'bottle';
      else if (/box/i.test(name)) packagingType = 'box';

      let unitsPerPack = parseInt(row.CONVERSION || row.Pack || row.packSize || row.unitsPerPack || '0', 10);
      if (!unitsPerPack || unitsPerPack === 0) {
        if (/400\s*g/i.test(name)) unitsPerPack = 400;
        else if (/1\s*kg|1000\s*g/i.test(name)) unitsPerPack = 1000;
        else if (/1x15|15tab|15's/i.test(name)) unitsPerPack = 15;
        else if (/1x30|30tab|30's/i.test(name)) unitsPerPack = 30;
        else if (/1x20|20's/i.test(name)) unitsPerPack = 20;
        else if (/1x6|6tab/i.test(name)) unitsPerPack = 6;
        else if (/syp|syrup|drop/i.test(name)) unitsPerPack = 1;
        else unitsPerPack = 10;
      }

      const mrp = parseFloat(String(row['M.R.P.'] || row.MRP || row.mrp || row.Rate || row.Price || '50.00')) || 50.0;
      const manufacturer = String(row.Company || row.COMPANY || row.Manufacturer || row.company || (isInfantMilk ? 'Nestle / Abbott' : 'Indian Pharma')).trim();
      const stock = Math.max(0, parseInt(String(row.Stock || row.STOCK || row.Qty || row.currentStock || '0'), 10) || 0);
      const hsnCode = row.HSNCode ? String(row.HSNCode).trim() : null;
      
      // Auto-detect chronic
      let isChronicMed = false;
      const checkStr = `${name} ${genericName} ${saltComposition} ${category}`.toUpperCase();
      for (const keyword of CHRONIC_KEYWORDS) {
        if (checkStr.includes(keyword.toUpperCase())) {
          isChronicMed = true;
          break;
        }
      }
      
      await db.medicine.upsert({
        where: { margItemCode },
        update: {
          name, genericName, category, saltComposition, unitsPerPack, mrp, manufacturer, isChronicMed, currentStock: stock, hsnCode
        },
        create: {
          margItemCode, name, genericName, category, saltComposition, unitsPerPack, mrp, manufacturer, isChronicMed,
          packagingType,
          packsPerBox: 10,
          currentStock: stock,
          reorderLevel: 20,
          hsnCode
        }
      });
      importedCount.medicines++;
    } else if (importType === 'sales') {
      // Import sales history to identify chronic customers
      const customerName = row.CUSTOMER_NAME || row['Customer Name'] || row.Party || row.Customer;
      const phone = row.PHONE || row.Mobile || row['Phone Number'] || row.Phone;
      const medicineName = row.ITEM_NAME || row.Medicine || row['Item Name'];
      const qty = parseInt(row.QTY || row.Quantity || '30', 10) || 30;

      if (customerName && phone) {
        const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
        if (cleanPhone.length >= 10) {
          const customer = await db.customer.upsert({
            where: { phone: cleanPhone },
            update: { name: customerName },
            create: {
              name: customerName,
              phone: cleanPhone,
              address: row.ADDRESS || row.Address || 'Local Customer',
              city: row.CITY || row.City || '',
              whatsappEnabled: true,
              consentGiven: true
            }
          });
          importedCount.customers++;

          // Try to link medicine if found
          if (medicineName) {
            const med = await db.medicine.findFirst({
              where: {
                OR: [
                  { name: { contains: medicineName } },
                  { genericName: { contains: medicineName } }
                ]
              }
            });

            if (med) {
              const existingPresc = await db.prescription.findFirst({
                where: { customerId: customer.id, medicineId: med.id }
              });

              const purchaseDate = row.DATE ? new Date(row.DATE) : new Date();
              const dailyDosage = 1; // default assumption for sales history
              const daysSupply = Math.floor(qty / dailyDosage);
              const nextRefill = new Date(purchaseDate);
              nextRefill.setDate(nextRefill.getDate() + daysSupply - 3);

              if (!existingPresc) {
                await db.prescription.create({
                  data: {
                    customerId: customer.id,
                    medicineId: med.id,
                    dailyDosage,
                    lastPurchaseDate: purchaseDate,
                    lastPurchaseQty: qty,
                    nextRefillDate: nextRefill,
                    bufferDays: 3,
                    isActive: true
                  }
                });
                importedCount.prescriptions++;
              }
            }
          }
        }
      }
    }
  }
  
  return importedCount;
}
