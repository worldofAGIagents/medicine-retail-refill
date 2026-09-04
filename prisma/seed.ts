import { PrismaClient } from '@prisma/client';
import { addDays } from 'date-fns';
import { calculateRefill } from '../src/lib/refill-engine';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database...');
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.refillLog.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.medicine.deleteMany();

  console.log('Seeding Medicines...');
  const meds = [
    { name: 'Metformin 500mg (Glycomet)', genericName: 'Metformin', category: 'Diabetes', isChronicMed: true, mrp: 50, unitsPerPack: 10, margItemCode: 'M001' },
    { name: 'Metformin 850mg (Glycomet)', genericName: 'Metformin', category: 'Diabetes', isChronicMed: true, mrp: 80, unitsPerPack: 10, margItemCode: 'M002' },
    { name: 'Glimepiride 2mg (Amaryl)', genericName: 'Glimepiride', category: 'Diabetes', isChronicMed: true, mrp: 120, unitsPerPack: 10, margItemCode: 'M003' },
    { name: 'Amlodipine 5mg (Amlokind)', genericName: 'Amlodipine', category: 'BP', isChronicMed: true, mrp: 40, unitsPerPack: 10, margItemCode: 'M004' },
    { name: 'Telmisartan 40mg (Telma)', genericName: 'Telmisartan', category: 'BP', isChronicMed: true, mrp: 90, unitsPerPack: 10, margItemCode: 'M005' },
    { name: 'Losartan 50mg (Losar)', genericName: 'Losartan', category: 'BP', isChronicMed: true, mrp: 75, unitsPerPack: 10, margItemCode: 'M006' },
    { name: 'Atorvastatin 10mg (Atorva)', genericName: 'Atorvastatin', category: 'Cholesterol', isChronicMed: true, mrp: 110, unitsPerPack: 10, margItemCode: 'M007' },
    { name: 'Rosuvastatin 10mg (Rozavel)', genericName: 'Rosuvastatin', category: 'Cholesterol', isChronicMed: true, mrp: 150, unitsPerPack: 10, margItemCode: 'M008' },
    { name: 'Thyronorm 50mcg', genericName: 'Levothyroxine', category: 'Thyroid', isChronicMed: true, mrp: 200, unitsPerPack: 100, packagingType: 'bottle', margItemCode: 'M009' },
    { name: 'Thyronorm 75mcg', genericName: 'Levothyroxine', category: 'Thyroid', isChronicMed: true, mrp: 220, unitsPerPack: 100, packagingType: 'bottle', margItemCode: 'M010' },
    { name: 'Ecosprin 75mg (Aspirin)', genericName: 'Aspirin', category: 'Heart', isChronicMed: true, mrp: 15, unitsPerPack: 14, margItemCode: 'M011' },
    { name: 'Pantoprazole 40mg (Pan-D)', genericName: 'Pantoprazole', category: 'Gastric', isChronicMed: false, mrp: 130, unitsPerPack: 10, margItemCode: 'M012' },
    { name: 'Clopidogrel 75mg (Clopivas)', genericName: 'Clopidogrel', category: 'Heart', isChronicMed: true, mrp: 140, unitsPerPack: 10, margItemCode: 'M013' },
    { name: 'Sitagliptin 50mg (Januvia)', genericName: 'Sitagliptin', category: 'Diabetes', isChronicMed: true, mrp: 350, unitsPerPack: 7, margItemCode: 'M014' },
    { name: 'Vildagliptin 50mg (Galvus)', genericName: 'Vildagliptin', category: 'Diabetes', isChronicMed: true, mrp: 400, unitsPerPack: 14, margItemCode: 'M015' },
    { name: 'Nestle Nan Pro 1 (400g Tin)', genericName: 'Infant Milk Formula (Up to 6 Months)', category: 'Infant Milk', isChronicMed: true, mrp: 825, unitsPerPack: 400, packagingType: 'tin', margItemCode: 'M016' },
    { name: 'Similac Advance Stage 1 (400g)', genericName: 'Infant Formula With HMO', category: 'Infant Milk', isChronicMed: true, mrp: 795, unitsPerPack: 400, packagingType: 'tin', margItemCode: 'M017' },
    { name: 'Nestle Lactogen 1 (400g Bag-in-Box)', genericName: 'Infant Formula Spray Dried', category: 'Infant Milk', isChronicMed: true, mrp: 460, unitsPerPack: 400, packagingType: 'box', margItemCode: 'M018' },
    { name: 'Aptamil Gold Stage 1 (400g)', genericName: 'Infant Formula with Prebiotics', category: 'Infant Milk', isChronicMed: true, mrp: 890, unitsPerPack: 400, packagingType: 'tin', margItemCode: 'M019' }
  ];

  const createdMeds = [];
  for (const med of meds) {
    createdMeds.push(await prisma.medicine.create({ data: med }));
  }

  console.log('Seeding Customers...');
  const customers = [
    { name: 'Amit Kumar', phone: '9876543210', locality: 'Sector 18', city: 'Noida', address: 'B-12, Sector 18, Noida' },
    { name: 'Priya Sharma', phone: '9823456789', locality: 'MG Road', city: 'Delhi', address: 'Plot 45, MG Road, Delhi' },
    { name: 'Rajesh Gupta', phone: '9871234567', locality: 'Civil Lines', city: 'Lucknow', address: '12 Civil Lines, Lucknow' },
    { name: 'Sunita Devi', phone: '9845678901', locality: 'Gomti Nagar', city: 'Lucknow', address: 'Flat 201 Gomti Nagar' },
    { name: 'Mohan Lal', phone: '9834567890', locality: 'Aliganj', city: 'Lucknow', address: 'House 88 Aliganj' },
    { name: 'Kavita Singh', phone: '9812345678', locality: 'Hazratganj', city: 'Lucknow', address: 'Shop 4 Hazratganj' },
    { name: 'Ramesh Yadav', phone: '9801234567', locality: 'Indira Nagar', city: 'Lucknow', address: 'Block C Indira Nagar' },
    { name: 'Neha Verma', phone: '9890123456', locality: 'Ashiyana', city: 'Lucknow', address: '55 Ashiyana Colony' },
    { name: 'Suresh Tiwari', phone: '9878901234', locality: 'Mahanagar', city: 'Lucknow', address: 'Sector B Mahanagar' },
    { name: 'Anita Mishra', phone: '9867890123', locality: 'Aminabad', city: 'Lucknow', address: 'Aminabad Market' },
    { name: 'Pooja Malhotra (Mother of Baby Aarav)', phone: '9818812345', locality: 'Sector 50', city: 'Noida', address: 'Flat 402, Lotus Panache, Sector 110, Noida' }
  ];

  const createdCustomers = [];
  for (const cust of customers) {
    createdCustomers.push(await prisma.customer.create({ data: cust }));
  }

  console.log('Seeding Prescriptions...');
  const today = new Date();
  
  // Mix of urgent, due soon, ok
  const prescriptionScenarios = [
    { offsetDays: -30, qty: 30, dosage: 1 }, // overdue
    { offsetDays: -28, qty: 30, dosage: 1 }, // urgent
    { offsetDays: -26, qty: 30, dosage: 1 }, // due_soon
    { offsetDays: -20, qty: 30, dosage: 1 }, // ok
    { offsetDays: -5, qty: 60, dosage: 2 }   // future
  ];

  for (let i = 0; i < 15; i++) {
    const customer = createdCustomers[i % createdCustomers.length];
    const medicine = createdMeds[i % createdMeds.length];
    const scenario = prescriptionScenarios[i % prescriptionScenarios.length];
    
    const lastPurchaseDate = addDays(today, scenario.offsetDays);
    const lastPurchaseQty = scenario.qty;
    const dailyDosage = scenario.dosage;
    
    const calc = calculateRefill({
      lastPurchaseDate,
      lastPurchaseQty,
      dailyDosage,
      bufferDays: 3
    });

    await prisma.prescription.create({
      data: {
        customerId: customer.id,
        medicineId: medicine.id,
        dailyDosage,
        dosageSchedule: 'Morning',
        lastPurchaseDate,
        lastPurchaseQty,
        nextRefillDate: calc.nextRefillDate,
        isActive: true
      }
    });
  }

  // Add Infant Milk Subscription
  const pooja = createdCustomers.find(c => c.name.includes('Pooja'));
  const nanPro = createdMeds.find(m => m.name.includes('Nan Pro'));
  if (pooja && nanPro) {
    const lastPurchaseDate = addDays(today, -8); // Bought 8 days ago
    const lastPurchaseQty = 400; // 400g Tin
    const dailyDosage = 40; // 40g/day (approx 4 feeds) = 10 days supply
    const calc = calculateRefill({
      lastPurchaseDate,
      lastPurchaseQty,
      dailyDosage,
      bufferDays: 2
    });

    await prisma.prescription.create({
      data: {
        customerId: pooja.id,
        medicineId: nanPro.id,
        dailyDosage,
        dosageSchedule: '4 feeds/day (approx 40g)',
        lastPurchaseDate,
        lastPurchaseQty,
        nextRefillDate: calc.nextRefillDate,
        customPackaging: '400g Tin',
        unitType: 'grams',
        bufferDays: 2,
        isActive: true
      }
    });
  }

  console.log('Seeding Orders...');
  for (let i = 0; i < 3; i++) {
    const customer = createdCustomers[i];
    await prisma.order.create({
      data: {
        customerId: customer.id,
        status: ['preparing', 'out_for_delivery', 'delivered'][i],
        totalAmount: 500 + i * 100,
        items: {
          create: [
            {
              medicineName: createdMeds[i].name,
              medicineId: createdMeds[i].id,
              quantity: 2,
              unitPrice: createdMeds[i].mrp,
              totalPrice: createdMeds[i].mrp * 2
            }
          ]
        }
      }
    });
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
