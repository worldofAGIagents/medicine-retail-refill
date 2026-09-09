import assert from 'assert';
import { db } from '../src/lib/db';
import { isSyrupMedicine, calculateRefill } from '../src/lib/refill-engine';
import { detectMedicineCategory, normalizeChronicCategory, DEFAULT_CHRONIC_CATEGORY } from '../src/lib/medicine-classifier';
import { isInfantFormula, getDefaultDiscountPercent, calculateLineItem, calculateBillSummary, generateWhatsAppBillText } from '../src/lib/billing-engine';
import { POST as onboardCustomer } from '../src/app/api/customers/onboard/route';
import { GET as getCustomers } from '../src/app/api/customers/route';
import { GET as getMedicines, POST as createMedicine } from '../src/app/api/medicines/route';
import { GET as getSettings, POST as saveSettings } from '../src/app/api/settings/route';
import { POST as loginUser } from '../src/app/api/auth/login/route';
import { comparePassword } from '../src/lib/auth';

async function runMasterAudit() {
  console.log('🚀 ========================================================');
  console.log('🚀 MASTER PHARMACY AUDIT & VERIFICATION SUITE');
  console.log('🚀 ========================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    totalTests++;
    try {
      const res = fn();
      if (res && typeof res.then === 'function') {
        return res
          .then(() => {
            passedTests++;
            console.log(`  ✅ PASS: ${name}`);
          })
          .catch((err: any) => {
            console.error(`  ❌ FAIL: ${name} ->`, err.message);
          });
      }
      passedTests++;
      console.log(`  ✅ PASS: ${name}`);
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name} ->`, err.message);
    }
  }

  // -------------------------------------------------------------
  // SECTION 1: SUPABASE POSTGRESQL & DATA PERSISTENCE
  // -------------------------------------------------------------
  console.log('📦 --- SECTION 1: Supabase PostgreSQL & Data Persistence ---');

  const medCount = await db.medicine.count();
  const userCount = await db.user.count();
  const settingCount = await db.pharmacySetting.count();
  console.log(`  📊 Supabase Table Counts: ${medCount} medicines, ${userCount} users, ${settingCount} settings`);

  await test('1.1 Supabase contains all 9,259 medicines from MARG ERP', () => {
    assert(medCount >= 9259, `Expected >= 9259 medicines, got ${medCount}`);
  });

  await test('1.2 Supabase contains 2 user accounts (Admin and Pharmacist)', () => {
    assert(userCount >= 2, `Expected >= 2 users, got ${userCount}`);
  });

  await test('1.3 Supabase contains all 22 pharmacy settings', () => {
    assert(settingCount >= 22, `Expected >= 22 settings, got ${settingCount}`);
  });

  await test('1.4 Case-insensitive search on PostgreSQL works for lowercase queries', async () => {
    const req = new Request('http://localhost:3005/api/medicines?q=telma');
    const res = await getMedicines(req);
    const data = await res.json();
    assert(data.data && data.data.length > 0, 'Expected to find TELMA medicines with lowercase query');
    const hasTelma = data.data.some((m: any) => m.name.toLowerCase().includes('telma'));
    assert(hasTelma, 'Expected returned items to include TELMA');
  });

  await test('1.5 Customer onboarding persists permanently to Supabase PostgreSQL', async () => {
    const testPhone = '9800011122';
    await db.customer.deleteMany({ where: { phone: testPhone } });

    const req = new Request('http://localhost:3005/api/customers/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Master Test Patient',
        phone: testPhone,
        locality: 'Sarfuddinpur Ward 2',
        address: 'Near Middle School',
        condition: 'Blood Pressure',
        medicines: [
          {
            name: 'TELMA 40MG TAB  1X15',
            dailyDosage: 1,
            quantityPurchased: 30,
            customPackaging: '2 strips (15 tabs/strip)',
            category: 'Blood Pressure'
          }
        ]
      })
    });

    const res = await onboardCustomer(req);
    assert.strictEqual(res.status, 200, 'Expected HTTP 200 from customer onboarding');
    const result = await res.json();
    assert(result.customer && result.customer.id, 'Expected customer to be created with ID');
    assert.strictEqual(result.customer.phone, testPhone);
    assert(result.prescriptions && result.prescriptions.length === 1, 'Expected 1 prescription created');

    // Direct database query verification
    const dbCustomer = await db.customer.findUnique({
      where: { phone: testPhone },
      include: { prescriptions: { include: { medicine: true } } }
    });
    assert(dbCustomer, 'Expected customer to exist in Supabase PostgreSQL');
    assert.strictEqual(dbCustomer?.name, 'Master Test Patient');
    assert.strictEqual(dbCustomer?.prescriptions.length, 1);
    assert(dbCustomer?.prescriptions[0].medicine.name.includes('TELMA'));

    // Cleanup
    await db.customer.deleteMany({ where: { phone: testPhone } });
  });

  // -------------------------------------------------------------
  // SECTION 2: CLINICAL REFILL & SYRUP NEXT-DAY ENGINE
  // -------------------------------------------------------------
  console.log('\n🩺 --- SECTION 2: Clinical Refill & Syrup Next-Day Engine ---');

  await test('2.1 isSyrupMedicine identifies liquid formulations correctly', () => {
    assert.strictEqual(isSyrupMedicine({ name: 'BENADRYL COUGH SYRUP 100ML' }), true);
    assert.strictEqual(isSyrupMedicine({ name: 'ASCORIL D PLUS SUSPENSION' }), true);
    assert.strictEqual(isSyrupMedicine({ name: 'GELUSIL MPS ORAL LIQUID' }), true);
    assert.strictEqual(isSyrupMedicine({ name: 'NASIVIN PEDIATRIC DROPS' }), true);
  });

  await test('2.2 isSyrupMedicine does NOT misclassify tablet/capsule bottles as syrup', () => {
    assert.strictEqual(isSyrupMedicine({ name: 'ACITROM 4MG TAB 1X30', packagingType: 'bottle' }), false);
    assert.strictEqual(isSyrupMedicine({ name: 'THYRONORM 50MCG TAB 1X120', packagingType: 'bottle' }), false);
    assert.strictEqual(isSyrupMedicine({ name: 'SHELCAL 500 TAB 1X15' }), false);
  });

  await test('2.3 Syrup purchased today is scheduled for Next Day (tomorrow)', () => {
    const refill = calculateRefill({
      lastPurchaseDate: new Date(),
      lastPurchaseQty: 1,
      dailyDosage: 1,
      bufferDays: 1,
      medicineName: 'GELUSIL SYRUP 200ML',
      packagingType: 'bottle'
    });
    assert.strictEqual(refill.isSyrup, true, 'Expected isSyrup: true');
    assert.strictEqual(refill.daysRemaining, 1, 'Expected 1 day remaining for next day refill');
    assert.strictEqual(refill.urgency, 'urgent', 'Expected urgent status for next day refill');
  });

  await test('2.4 Chronic condition defaults safely to Blood Pressure (BP)', () => {
    assert.strictEqual(normalizeChronicCategory(''), DEFAULT_CHRONIC_CATEGORY);
    assert.strictEqual(normalizeChronicCategory('General'), DEFAULT_CHRONIC_CATEGORY);
    assert.strictEqual(normalizeChronicCategory('BP'), 'Blood Pressure');
    assert.strictEqual(normalizeChronicCategory('Blood Pressure'), 'Blood Pressure');
  });

  // -------------------------------------------------------------
  // SECTION 3: RETAIL BILLING & POS ENGINE
  // -------------------------------------------------------------
  console.log('\n💳 --- SECTION 3: Retail Billing POS Engine & Margin Rules ---');

  await test('3.1 Inline MRP Editing dynamically updates line item totals', () => {
    // 2 strips at MRP 140 with 10% discount
    const item1 = calculateLineItem({ mrp: 140, quantity: 2, discountPercent: 10 });
    assert.strictEqual(item1.grossTotal, 280);
    assert.strictEqual(item1.discountAmount, 28);
    assert.strictEqual(item1.netTotal, 252);

    // Edit MRP upward to 180
    const item2 = calculateLineItem({ mrp: 180, quantity: 2, discountPercent: 10 });
    assert.strictEqual(item2.grossTotal, 360);
    assert.strictEqual(item2.discountAmount, 36);
    assert.strictEqual(item2.netTotal, 324);
  });

  await test('3.2 Infant Milk Formula Margin Protection: strictly 0% default discount', () => {
    const brands = ['Lactogen 1 400g Tin', 'Nan Pro 2 Formula', 'Similac Plus 400g', 'Aptamil Stage 1', 'Cerelac Wheat Apple'];
    for (const b of brands) {
      assert.strictEqual(isInfantFormula(b), true, `Expected ${b} to be identified as infant formula`);
      assert.strictEqual(getDefaultDiscountPercent(b), 0, `Expected 0% default discount for ${b}`);
    }
  });

  await test('3.3 Standard medicines receive 10% default discount', () => {
    const meds = ['Telma 40', 'Glycomet 500', 'Amlokind 5', 'Pan-D'];
    for (const m of meds) {
      assert.strictEqual(isInfantFormula(m), false, `Expected ${m} NOT to be infant formula`);
      assert.strictEqual(getDefaultDiscountPercent(m), 10, `Expected 10% default discount for ${m}`);
    }
  });

  await test('3.4 Pharmacist manual discount override works on infant formula', () => {
    const item = calculateLineItem({ mrp: 450, quantity: 2, discountPercent: 5, isCustomDiscount: true });
    assert.strictEqual(item.grossTotal, 900);
    assert.strictEqual(item.discountAmount, 45);
    assert.strictEqual(item.netTotal, 855);
  });

  await test('3.5 Bill Privacy: WhatsApp bill strictly omits GST and DL numbers', () => {
    const bill = calculateBillSummary(
      [{ mrp: 140, quantity: 2, discountPercent: 10, name: 'TELMA 40MG' }],
      {
        customerName: 'Manoj Test',
        customerPhone: '9888877777',
        invoiceNo: 'INV-2026-0001',
      }
    );
    const text = generateWhatsAppBillText(bill, {
      name: 'Manoj Medical Hall',
      address: 'Sarfuddinpur, Gopalpur, Muzaffarpur, Bihar - 843118',
      phone: '9431422744',
      upiId: 'manojmedical@okhdfcbank',
      upiPayeeName: 'Manoj Medical Hall',
    });
    assert(!text.includes('GSTIN:'), 'WhatsApp bill must not contain GSTIN:');
    assert(!text.includes('DL:'), 'WhatsApp bill must not contain DL:');
    assert(!text.includes('07AAAAA0000A1Z5'), 'WhatsApp bill must not contain mock GSTIN');
    assert(!text.includes('DL-2024-001234'), 'WhatsApp bill must not contain mock DL');
    assert(text.includes('9431422744'), 'WhatsApp bill must contain real pharmacy phone');
    assert(text.includes('manojmedical@okhdfcbank'), 'WhatsApp bill must contain shop UPI ID');
  });

  // -------------------------------------------------------------
  // SECTION 4: SETTINGS, AUTH & USER CREDENTIALS
  // -------------------------------------------------------------
  console.log('\n🔒 --- SECTION 4: Settings, Auth & User Credentials ---');

  await test('4.1 GET /api/settings returns permanent store details from Supabase', async () => {
    const req = new Request('http://localhost:3005/api/settings');
    const res = await getSettings(req);
    const settings = await res.json();
    assert.strictEqual(settings.pharmacyName, 'Manoj Medical Hall');
    assert(settings.phone === '6200314615' || settings.phone === '9431422744', 'Unexpected phone: ' + settings.phone);
    assert.strictEqual(settings.upiId, 'manojmedical@okhdfcbank');
    assert.strictEqual(settings.dlNumber, '');
    assert.strictEqual(settings.gstin, '');
  });

  await test('4.2 User Authentication: admin@medrefill.in authenticates with pharmacy123', async () => {
    const req = new Request('http://localhost:3005/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@medrefill.in',
        password: 'pharmacy123'
      })
    });
    const res = await loginUser(req);
    assert.strictEqual(res.status, 200, 'Expected HTTP 200 for valid login');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.email, 'admin@medrefill.in');
  });

  await test('4.3 User Authentication: worldofagent@gmail.com authenticates with pharmacy123', async () => {
    const req = new Request('http://localhost:3005/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'worldofagent@gmail.com',
        password: 'pharmacy123'
      })
    });
    const res = await loginUser(req);
    assert.strictEqual(res.status, 200, 'Expected HTTP 200 for valid admin login');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.user.email, 'worldofagent@gmail.com');
  });

  await test('4.4 Invalid password returns HTTP 401 Unauthorized', async () => {
    const req = new Request('http://localhost:3005/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@medrefill.in',
        password: 'wrongpassword'
      })
    });
    const res = await loginUser(req);
    assert.strictEqual(res.status, 401, 'Expected HTTP 401 for wrong password');
  });

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n========================================================');
  console.log(`📊 MASTER AUDIT RESULT: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('========================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL AUDIT ASSERTIONS PASSED WITH ZERO ERRORS!');
  } else {
    console.error(`💥 ${totalTests - passedTests} ASSERTION(S) FAILED!`);
    process.exit(1);
  }
}

runMasterAudit().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
