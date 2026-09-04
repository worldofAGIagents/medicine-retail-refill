import Papa from 'papaparse';
import { db } from './db';

const CHRONIC_KEYWORDS = [
  'Metformin', 'Glimepiride', 'Gliclazide', 'Amlodipine', 'Telmisartan', 'Losartan', 
  'Atorvastatin', 'Rosuvastatin', 'Thyroxine', 'Levothyroxine', 'Enalapril', 
  'Ramipril', 'Olmesartan', 'Valsartan', 'Sitagliptin', 'Vildagliptin', 
  'Pioglitazone', 'Insulin', 'Teneligliptin', 'Dapagliflozin', 'Empagliflozin',
  'Nan Pro', 'Lactogen', 'Similac', 'Aptamil', 'Dexolac', 'Infant Formula', 'Infant Milk', 'Pediasure'
];

export async function parseMargCSV(csvText: string, importType: string = 'medicines') {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  
  const records = result.data as any[];
  const importedCount = { medicines: 0, customers: 0, prescriptions: 0 };
  
  for (const row of records) {
    if (importType === 'medicines' || !importType) {
      const name = row.ITEM_NAME || row.Name || row.name || row['Item Name'] || '';
      if (!name) continue;

      const isInfantMilk = /nan pro|lactogen|similac|aptamil|dexolac|infant milk|infant formula/i.test(`${name} ${row.SALT || ''}`);
      const margItemCode = row.ITEM_CODE || row.Code || row.code || `MARG-${name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 30).toUpperCase()}`;
      const genericName = row.SALT || row.Generic || row.genericName || row['Generic Name'] || (isInfantMilk ? 'Infant Milk Formula' : 'Generic Salt');
      const category = row.CATEGORY || row.Category || row.category || (
        isInfantMilk ? 'Infant Milk' :
        name.toLowerCase().includes('metformin') || name.toLowerCase().includes('glycomet') ? 'Diabetes' :
        name.toLowerCase().includes('amlo') || name.toLowerCase().includes('telma') ? 'Blood Pressure' :
        name.toLowerCase().includes('thyro') ? 'Thyroid' :
        name.toLowerCase().includes('atorva') ? 'Cholesterol' : 'General'
      );
      const saltComposition = row.SALT || row.Salt || genericName;

      let packagingType = 'strip';
      if (isInfantMilk || /tin|jar|box|bottle|powder/i.test(name)) {
        packagingType = /tin/i.test(name) ? 'tin' : /bottle/i.test(name) ? 'bottle' : 'box';
      }

      let unitsPerPack = parseInt(row.CONVERSION || row.Pack || row.packSize || row.unitsPerPack || '0', 10);
      if (!unitsPerPack || unitsPerPack === 0) {
        if (/400\s*g/i.test(name)) unitsPerPack = 400;
        else if (/1\s*kg|1000\s*g/i.test(name)) unitsPerPack = 1000;
        else unitsPerPack = 10;
      }

      const mrp = parseFloat(row.MRP || row.mrp || row.Price || '50.00') || 50.0;
      const manufacturer = row.COMPANY || row.Manufacturer || row.company || (isInfantMilk ? 'Nestle / Abbott' : 'Standard Pharma');
      const stock = parseInt(row.STOCK || row.Qty || row.currentStock || '100', 10) || 100;
      
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
          name, genericName, category, saltComposition, unitsPerPack, mrp, manufacturer, isChronicMed, currentStock: stock
        },
        create: {
          margItemCode, name, genericName, category, saltComposition, unitsPerPack, mrp, manufacturer, isChronicMed,
          packagingType: 'strip',
          packsPerBox: 10,
          currentStock: stock,
          reorderLevel: 30
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
