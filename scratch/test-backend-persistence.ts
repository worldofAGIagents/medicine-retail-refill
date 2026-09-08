/**
 * Automated Backend & Data Persistence Test Script
 * Medicine Retail Refill Application
 *
 * Verifies:
 * 1. Settings API & Phone Persistence:
 *    - Updating phone in db.pharmacySetting via POST /api/settings persists custom numbers ('9835012345').
 *    - Setting phone to empty string ('') or clearing it does NOT revert to mock number '+91 98765 43210'.
 *    - GET /api/settings returns exact saved phone number without fallback to '+91 98765 43210'.
 *    - GSTIN and DL can be set or cleared and do not revert to hardcoded mock values.
 *
 * 2. Medicine Creation API (POST /api/medicines):
 *    - Creating medicine with required name and MRP.
 *    - Category defaults to 'Blood Pressure'.
 *    - packagingType defaults to 'strip' and unitsPerPack defaults to 10.
 *    - Unique margItemCode auto-generated if omitted.
 *    - Creating an Infant Milk formula medicine.
 *    - Data cleanup after testing.
 *
 * 3. WhatsApp Bill Privacy:
 *    - generateWhatsAppBillText with sample bill summary.
 *    - Assert neither 'DL:' nor 'GSTIN:' nor any mock DL/GSTIN strings appear anywhere in the message.
 */

import assert from 'assert';
import { db } from '../src/lib/db';
import { GET as getSettings, POST as saveSettings } from '../src/app/api/settings/route';
import { POST as createMedicine } from '../src/app/api/medicines/route';
import {
  generateWhatsAppBillText,
  calculateBillSummary,
  calculateLineItem,
  PharmacyDetails,
  BillSummary,
} from '../src/lib/billing-engine';

interface TestCaseResult {
  suite: string;
  testId: string;
  name: string;
  status: 'PASS' | 'FAIL';
  durationMs: number;
  error?: string;
  details?: any;
}

const testResults: TestCaseResult[] = [];
const createdMedicineIds: string[] = [];
let originalSettings: { key: string; value: string }[] = [];

function logSection(title: string) {
  console.log(`\n===============================================================`);
  console.log(`  ${title}`);
  console.log(`===============================================================`);
}

async function runTestCase(
  suite: string,
  testId: string,
  name: string,
  testFn: () => Promise<void> | void
) {
  const start = Date.now();
  try {
    await testFn();
    const durationMs = Date.now() - start;
    testResults.push({ suite, testId, name, status: 'PASS', durationMs });
    console.log(`  \x1b[32m✔ PASS\x1b[0m [${durationMs}ms] [${testId}] ${name}`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    testResults.push({
      suite,
      testId,
      name,
      status: 'FAIL',
      durationMs,
      error: err?.message || String(err),
    });
    console.error(`  \x1b[31m✘ FAIL\x1b[0m [${durationMs}ms] [${testId}] ${name}`);
    console.error(`    \x1b[33mError: ${err?.message || err}\x1b[0m`);
    if (err?.stack) {
      console.error(`    ${err.stack.split('\n').slice(1, 4).join('\n    ')}`);
    }
  }
}

async function main() {
  console.log('\n🚀 Starting Backend & Data Persistence Test Specialist Suite...');
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  // ---------------------------------------------------------------------------
  // STEP 0: Backup original pharmacy settings for zero side-effects
  // ---------------------------------------------------------------------------
  try {
    const rows = await db.pharmacySetting.findMany();
    originalSettings = rows.map((r) => ({ key: r.key, value: r.value }));
    console.log(`\n📦 Backed up ${originalSettings.length} initial pharmacy setting rows.`);
  } catch (backupErr) {
    console.warn('⚠️ Could not backup settings, proceeding anyway:', backupErr);
  }

  // ===========================================================================
  // SUITE 1: Settings API & Phone / GSTIN / DL Persistence
  // ===========================================================================
  logSection('SUITE 1: Settings API & Phone / GSTIN / DL Persistence');

  await runTestCase(
    'Settings API',
    'SET-01',
    'POST /api/settings persists custom phone number (e.g. 9835012345)',
    async () => {
      const customPhone = '9835012345';
      const postReq = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: customPhone }),
      });

      const postRes = await saveSettings(postReq);
      assert.strictEqual(postRes.status, 200, `POST /api/settings returned status ${postRes.status}`);

      const postBody = await postRes.json();
      assert.strictEqual(postBody.success, true, 'POST /api/settings should return success: true');
      assert.strictEqual(
        postBody.settings.phone,
        customPhone,
        `Response settings.phone should match custom phone ${customPhone}`
      );

      // Direct Database Verification
      const dbRow = await db.pharmacySetting.findUnique({ where: { key: 'phone' } });
      assert.ok(dbRow, 'db.pharmacySetting must contain a record with key="phone"');
      assert.strictEqual(
        dbRow.value,
        customPhone,
        `db.pharmacySetting.value for "phone" must be "${customPhone}", got "${dbRow.value}"`
      );
    }
  );

  await runTestCase(
    'Settings API',
    'SET-02',
    'GET /api/settings returns exact saved custom phone without fallback',
    async () => {
      const getReq = new Request('http://localhost:3000/api/settings');
      const getRes = await getSettings(getReq);
      assert.strictEqual(getRes.status, 200, `GET /api/settings returned status ${getRes.status}`);

      const getBody = await getRes.json();
      assert.strictEqual(
        getBody.phone,
        '9835012345',
        `GET /api/settings should return phone="9835012345", got "${getBody.phone}"`
      );
      assert.notStrictEqual(
        getBody.phone,
        '+91 98765 43210',
        'GET /api/settings must not return fallback mock phone "+91 98765 43210"'
      );
    }
  );

  await runTestCase(
    'Settings API',
    'SET-03',
    'POST /api/settings with empty phone persists empty string and does NOT revert to +91 98765 43210',
    async () => {
      const postReq = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '' }),
      });

      const postRes = await saveSettings(postReq);
      assert.strictEqual(postRes.status, 200);

      const postBody = await postRes.json();
      assert.strictEqual(postBody.success, true);
      assert.strictEqual(
        postBody.settings.phone,
        '',
        'Settings response should contain empty string for phone'
      );

      // Direct Database Verification
      const dbRow = await db.pharmacySetting.findUnique({ where: { key: 'phone' } });
      assert.ok(dbRow, 'db.pharmacySetting key="phone" row must exist');
      assert.strictEqual(
        dbRow.value,
        '',
        `db.pharmacySetting value must be empty string "", got "${dbRow.value}"`
      );

      // Verification via GET /api/settings
      const getReq = new Request('http://localhost:3000/api/settings');
      const getRes = await getSettings(getReq);
      const getBody = await getRes.json();

      assert.strictEqual(
        getBody.phone,
        '',
        `GET /api/settings must return empty string "" for phone, got "${getBody.phone}"`
      );
      assert.notStrictEqual(
        getBody.phone,
        '+91 98765 43210',
        'Cleared phone must NEVER fall back to mock number "+91 98765 43210"'
      );
      assert.notStrictEqual(
        getBody.phone,
        '9876543210',
        'Cleared phone must NEVER fall back to mock number "9876543210"'
      );
    }
  );

  await runTestCase(
    'Settings API',
    'SET-04',
    'GSTIN and DL can be set with custom values and persist in DB and GET API',
    async () => {
      const customDl = 'BR-MUZ-20-21-98765';
      const customGst = '10AABCM1234F1Z5';

      const postReq = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dlNumber: customDl, gstin: customGst }),
      });

      const postRes = await saveSettings(postReq);
      assert.strictEqual(postRes.status, 200);

      // Direct DB check
      const dlRow = await db.pharmacySetting.findUnique({ where: { key: 'dlNumber' } });
      const gstRow = await db.pharmacySetting.findUnique({ where: { key: 'gstin' } });
      assert.strictEqual(dlRow?.value, customDl, 'Custom DL number must be stored in database');
      assert.strictEqual(gstRow?.value, customGst, 'Custom GSTIN must be stored in database');

      // GET API check
      const getReq = new Request('http://localhost:3000/api/settings');
      const getRes = await getSettings(getReq);
      const getBody = await getRes.json();

      assert.strictEqual(getBody.dlNumber, customDl, `GET dlNumber must be "${customDl}"`);
      assert.strictEqual(getBody.gstin, customGst, `GET gstin must be "${customGst}"`);
    }
  );

  await runTestCase(
    'Settings API',
    'SET-05',
    'GSTIN and DL can be cleared to empty string and do NOT revert to mock numbers',
    async () => {
      const postReq = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dlNumber: '', gstin: '' }),
      });

      const postRes = await saveSettings(postReq);
      assert.strictEqual(postRes.status, 200);

      // Direct DB check
      const dlRow = await db.pharmacySetting.findUnique({ where: { key: 'dlNumber' } });
      const gstRow = await db.pharmacySetting.findUnique({ where: { key: 'gstin' } });
      assert.strictEqual(dlRow?.value, '', 'Cleared DL number must be "" in database');
      assert.strictEqual(gstRow?.value, '', 'Cleared GSTIN must be "" in database');

      // GET API check
      const getReq = new Request('http://localhost:3000/api/settings');
      const getRes = await getSettings(getReq);
      const getBody = await getRes.json();

      assert.strictEqual(getBody.dlNumber, '', 'GET dlNumber must be empty string ""');
      assert.strictEqual(getBody.gstin, '', 'GET gstin must be empty string ""');

      // Assert against old mock DL & GST strings
      assert.notStrictEqual(
        getBody.dlNumber,
        'DL-20B/12345/2022',
        'dlNumber must not revert to seed default DL-20B/12345/2022'
      );
      assert.notStrictEqual(
        getBody.dlNumber,
        'BR-20B/MUZ/2022',
        'dlNumber must not revert to default BR-20B/MUZ/2022'
      );
      assert.notStrictEqual(
        getBody.gstin,
        '10ABCDE1234F1Z5',
        'gstin must not revert to seed default 10ABCDE1234F1Z5'
      );
      assert.notStrictEqual(
        getBody.gstin,
        '10AAAAA0000A1Z5',
        'gstin must not revert to dummy 10AAAAA0000A1Z5'
      );
    }
  );

  // ===========================================================================
  // SUITE 2: Medicine Creation API (POST /api/medicines)
  // ===========================================================================
  logSection('SUITE 2: Medicine Creation API (POST /api/medicines)');

  await runTestCase(
    'Medicine Creation',
    'MED-01',
    'Create medicine with required name and MRP; verify defaults (category=Blood Pressure, packagingType=strip, unitsPerPack=10)',
    async () => {
      const payload = {
        name: 'TEST_MED_Amlodipine 5mg Test',
        mrp: 55.5,
      };

      const req = new Request('http://localhost:3000/api/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await createMedicine(req);
      assert.strictEqual(res.status, 201, `Expected HTTP 201 Created, got ${res.status}`);

      const data = await res.json();
      assert.ok(data.id, 'Created medicine must have an id');
      createdMedicineIds.push(data.id);

      // Verify name and MRP
      assert.strictEqual(data.name, 'TEST_MED_Amlodipine 5mg Test');
      assert.strictEqual(data.mrp, 55.5);

      // Verify defaults
      assert.strictEqual(
        data.category,
        'Blood Pressure',
        `category must default to "Blood Pressure", got "${data.category}"`
      );
      assert.strictEqual(
        data.packagingType,
        'strip',
        `packagingType must default to "strip", got "${data.packagingType}"`
      );
      assert.strictEqual(
        data.unitsPerPack,
        10,
        `unitsPerPack must default to 10, got ${data.unitsPerPack}`
      );
      assert.strictEqual(
        data.genericName,
        'TEST_MED_Amlodipine 5mg Test',
        'genericName should default to medicine name'
      );
      assert.strictEqual(
        data.isChronicMed,
        true,
        'isChronicMed should default to true for non-general category'
      );

      // Direct DB Verification
      const medInDb = await db.medicine.findUnique({ where: { id: data.id } });
      assert.ok(medInDb, 'Medicine record must exist in database');
      assert.strictEqual(medInDb.name, 'TEST_MED_Amlodipine 5mg Test');
      assert.strictEqual(medInDb.category, 'Blood Pressure');
      assert.strictEqual(medInDb.packagingType, 'strip');
      assert.strictEqual(medInDb.unitsPerPack, 10);
      assert.strictEqual(medInDb.mrp, 55.5);
    }
  );

  await runTestCase(
    'Medicine Creation',
    'MED-02',
    'Verify unique margItemCode is auto-generated when omitted',
    async () => {
      // Create first medicine with margItemCode omitted
      const payload1 = {
        name: 'TEST_MED_AutoCode_A 10mg',
        mrp: 60.0,
      };
      const req1 = new Request('http://localhost:3000/api/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload1),
      });
      const res1 = await createMedicine(req1);
      assert.strictEqual(res1.status, 201);
      const data1 = await res1.json();
      createdMedicineIds.push(data1.id);

      assert.ok(data1.margItemCode, 'margItemCode must be generated');
      assert.ok(
        data1.margItemCode.startsWith('MAN-'),
        `margItemCode should start with "MAN-", got "${data1.margItemCode}"`
      );
      assert.ok(
        data1.margItemCode.length > 5,
        `margItemCode length should be > 5, got "${data1.margItemCode}"`
      );

      // Add a 15ms wait to ensure distinct timestamp-based code generation
      await new Promise((r) => setTimeout(r, 15));

      // Create second medicine with margItemCode omitted
      const payload2 = {
        name: 'TEST_MED_AutoCode_B 20mg',
        mrp: 85.0,
      };
      const req2 = new Request('http://localhost:3000/api/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload2),
      });
      const res2 = await createMedicine(req2);
      assert.strictEqual(res2.status, 201);
      const data2 = await res2.json();
      createdMedicineIds.push(data2.id);

      assert.ok(data2.margItemCode, 'Second medicine margItemCode must be generated');
      assert.ok(
        data2.margItemCode.startsWith('MAN-'),
        `Second margItemCode should start with "MAN-", got "${data2.margItemCode}"`
      );

      // Uniqueness assertion
      assert.notStrictEqual(
        data1.margItemCode,
        data2.margItemCode,
        `margItemCodes must be distinct: ${data1.margItemCode} vs ${data2.margItemCode}`
      );

      // Direct DB Verification
      const dbMed1 = await db.medicine.findUnique({ where: { margItemCode: data1.margItemCode } });
      const dbMed2 = await db.medicine.findUnique({ where: { margItemCode: data2.margItemCode } });
      assert.ok(dbMed1, 'Medicine 1 found by margItemCode in DB');
      assert.ok(dbMed2, 'Medicine 2 found by margItemCode in DB');
      assert.strictEqual(dbMed1.id, data1.id);
      assert.strictEqual(dbMed2.id, data2.id);
    }
  );

  await runTestCase(
    'Medicine Creation',
    'MED-03',
    'Create an Infant Milk formula medicine (category="Infant Milk", packaging="tin", unitsPerPack=1)',
    async () => {
      const infantMilkPayload = {
        name: 'TEST_MED_Lactogen 1 400g Spray Dried Formula',
        genericName: 'Infant Milk Formula (Up to 6 Months)',
        category: 'Infant Milk',
        packagingType: 'tin',
        unitsPerPack: 1,
        mrp: 465.0,
        manufacturer: 'Nestlé India Healthcare',
        saltComposition: 'Milk Solids, Demineralised Whey, Minerals, Vitamins',
        currentStock: 36,
        reorderLevel: 8,
      };

      const req = new Request('http://localhost:3000/api/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(infantMilkPayload),
      });

      const res = await createMedicine(req);
      assert.strictEqual(res.status, 201, `Expected status 201, got ${res.status}`);

      const data = await res.json();
      assert.ok(data.id, 'Created infant formula must have an id');
      createdMedicineIds.push(data.id);

      assert.strictEqual(data.name, 'TEST_MED_Lactogen 1 400g Spray Dried Formula');
      assert.strictEqual(data.genericName, 'Infant Milk Formula (Up to 6 Months)');
      assert.strictEqual(
        data.category,
        'Infant Milk',
        `Category should be "Infant Milk", got "${data.category}"`
      );
      assert.strictEqual(
        data.packagingType,
        'tin',
        `packagingType should be "tin", got "${data.packagingType}"`
      );
      assert.strictEqual(
        data.unitsPerPack,
        1,
        `unitsPerPack should be 1, got ${data.unitsPerPack}`
      );
      assert.strictEqual(data.mrp, 465.0);
      assert.strictEqual(data.manufacturer, 'Nestlé India Healthcare');
      assert.strictEqual(data.currentStock, 36);
      assert.strictEqual(data.reorderLevel, 8);

      // Direct DB Verification
      const medInDb = await db.medicine.findUnique({ where: { id: data.id } });
      assert.ok(medInDb, 'Infant milk medicine record must exist in DB');
      assert.strictEqual(medInDb.category, 'Infant Milk');
      assert.strictEqual(medInDb.packagingType, 'tin');
      assert.strictEqual(medInDb.unitsPerPack, 1);
      assert.strictEqual(medInDb.mrp, 465.0);
    }
  );

  await runTestCase(
    'Medicine Creation',
    'MED-04',
    'Validation: POST /api/medicines without medicine name returns 400 Bad Request',
    async () => {
      const invalidPayload = { mrp: 120.0 };
      const req = new Request('http://localhost:3000/api/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      const res = await createMedicine(req);
      assert.strictEqual(res.status, 400, `Expected 400 Bad Request, got ${res.status}`);

      const body = await res.json();
      assert.ok(body.error, 'Error message should be present in response');
      assert.ok(
        body.error.toLowerCase().includes('name is required'),
        `Error message should mention "name is required", got "${body.error}"`
      );
    }
  );

  await runTestCase(
    'Medicine Creation',
    'MED-05',
    'Cleanup: Delete all created test medicines from database and verify deletion',
    async () => {
      assert.ok(createdMedicineIds.length > 0, 'There should be medicines to clean up');
      const deleteResult = await db.medicine.deleteMany({
        where: { id: { in: createdMedicineIds } },
      });

      assert.strictEqual(
        deleteResult.count,
        createdMedicineIds.length,
        `Expected ${createdMedicineIds.length} deleted records, got ${deleteResult.count}`
      );

      // Verify DB no longer contains any of the test medicine IDs
      const remaining = await db.medicine.findMany({
        where: { id: { in: createdMedicineIds } },
      });
      assert.strictEqual(
        remaining.length,
        0,
        `All test medicines should be deleted, found ${remaining.length} remaining`
      );
    }
  );

  // ===========================================================================
  // SUITE 3: WhatsApp Bill Privacy Verification
  // ===========================================================================
  logSection('SUITE 3: WhatsApp Bill Privacy Verification');

  await runTestCase(
    'WhatsApp Bill Privacy',
    'WAP-01',
    'generateWhatsAppBillText strictly omits "DL:" and "GSTIN:" and mock license strings',
    async () => {
      // Pharmacy with licenses configured
      const pharmacyWithLicenses: PharmacyDetails = {
        name: 'Manoj Medical Hall',
        address: 'Sarfuddinpur, Gopalpur, Muzaffarpur, Bihar - 843118',
        phone: '9835012345',
        dlNumber: 'BR-MUZ-20-21-98765',
        gstin: '10AABCM1234F1Z5',
        upiId: '9835012345@okhdfcbank',
        upiPayeeName: 'Manoj Medical Hall',
      };

      // Create realistic multi-item bill: BP medicine (10% off) + Infant Milk (0% off) + Gastric (10% off)
      const bill = calculateBillSummary(
        [
          {
            name: 'Telma 40 (Telmisartan 40mg)',
            category: 'Blood Pressure',
            mrp: 120.0,
            quantity: 2,
          },
          {
            name: 'Lactogen 1 400g Tin',
            category: 'Infant Milk',
            mrp: 465.0,
            quantity: 1,
          },
          {
            name: 'Pantocid 40',
            category: 'Gastric',
            mrp: 155.0,
            quantity: 1,
          },
        ],
        {
          invoiceNo: 'MMH-26-00452',
          customerName: 'Ramesh Singh',
          customerVillage: 'Gopalpur',
          doctorName: 'Dr. S. K. Jha',
          paymentMode: 'upi',
        }
      );

      const message = generateWhatsAppBillText(bill, pharmacyWithLicenses);

      console.log('\n--- Sample WhatsApp Bill Generated Text ---');
      console.log(message);
      console.log('-------------------------------------------\n');

      // Assertions for Privacy:
      // 1. Literal checks for "DL:" and "GSTIN:"
      assert.strictEqual(
        message.includes('DL:'),
        false,
        'WhatsApp bill text must NOT contain "DL:"'
      );
      assert.strictEqual(
        message.includes('GSTIN:'),
        false,
        'WhatsApp bill text must NOT contain "GSTIN:"'
      );
      assert.strictEqual(
        message.includes('DL No'),
        false,
        'WhatsApp bill text must NOT contain "DL No"'
      );
      assert.strictEqual(
        message.includes('GST:'),
        false,
        'WhatsApp bill text must NOT contain "GST:"'
      );

      // 2. Exact string checks for mock and actual license numbers
      assert.strictEqual(
        message.includes('BR-MUZ-20-21-98765'),
        false,
        'WhatsApp bill text must NOT leak pharmacy.dlNumber ("BR-MUZ-20-21-98765")'
      );
      assert.strictEqual(
        message.includes('10AABCM1234F1Z5'),
        false,
        'WhatsApp bill text must NOT leak pharmacy.gstin ("10AABCM1234F1Z5")'
      );
      assert.strictEqual(
        message.includes('DL-20B/12345/2022'),
        false,
        'WhatsApp bill text must NOT contain mock DL "DL-20B/12345/2022"'
      );
      assert.strictEqual(
        message.includes('BR-20B/MUZ/2022'),
        false,
        'WhatsApp bill text must NOT contain mock DL "BR-20B/MUZ/2022"'
      );
      assert.strictEqual(
        message.includes('10ABCDE1234F1Z5'),
        false,
        'WhatsApp bill text must NOT contain mock GSTIN "10ABCDE1234F1Z5"'
      );
      assert.strictEqual(
        message.includes('10AAAAA0000A1Z5'),
        false,
        'WhatsApp bill text must NOT contain mock GSTIN "10AAAAA0000A1Z5"'
      );
      assert.strictEqual(
        message.includes('+91 98765 43210'),
        false,
        'WhatsApp bill text must NOT contain mock phone number "+91 98765 43210"'
      );

      // 3. Case-insensitive Regex checks for boundary patterns
      const dlPattern = /\bDL(\s*No)?\b\s*[:\-]/i;
      const gstinPattern = /\bGST(IN)?\b\s*[:\-]/i;
      assert.strictEqual(
        dlPattern.test(message),
        false,
        `Regex check failed: DL pattern detected in message`
      );
      assert.strictEqual(
        gstinPattern.test(message),
        false,
        `Regex check failed: GSTIN pattern detected in message`
      );

      // 4. Verification that legitimate customer-facing bill details ARE present
      assert.ok(
        message.includes('MANOJ MEDICAL HALL'),
        'Pharmacy name must be present in WhatsApp message'
      );
      assert.ok(
        message.includes('9835012345'),
        'Configured pharmacy contact phone must be present'
      );
      assert.ok(
        message.includes('MMH-26-00452'),
        'Invoice number must be present in WhatsApp message'
      );
      assert.ok(
        message.includes('Ramesh Singh (Gopalpur)'),
        'Customer name and village must be formatted correctly'
      );
      assert.ok(
        message.includes('Telma 40'),
        'Prescribed medicine item must be listed'
      );
      assert.ok(
        message.includes('Lactogen 1 400g Tin'),
        'Infant formula item must be listed'
      );
      assert.ok(
        message.includes(`NET AMOUNT PAYABLE: ₹${bill.netPayable}`),
        'Net payable amount must be clearly displayed'
      );
      assert.ok(
        message.includes('upi://pay?'),
        'Instant UPI payment deep link must be included for UPI bills'
      );
      assert.ok(
        message.includes('9835012345@okhdfcbank'),
        'Clean UPI ID must be included'
      );
    }
  );

  await runTestCase(
    'WhatsApp Bill Privacy',
    'WAP-02',
    'generateWhatsAppBillText with default pharmacy details omits DL/GSTIN and mock strings',
    async () => {
      const simpleBill = calculateBillSummary(
        [
          {
            name: 'Amlodipine 5mg',
            category: 'Blood Pressure',
            mrp: 50.0,
            quantity: 1,
          },
        ],
        {
          customerName: 'Sunita Devi',
          paymentMode: 'cash',
        }
      );

      // Call without passing pharmacy details (uses default parameter)
      const defaultMessage = generateWhatsAppBillText(simpleBill);

      assert.strictEqual(defaultMessage.includes('DL:'), false, 'Default text has no "DL:"');
      assert.strictEqual(defaultMessage.includes('GSTIN:'), false, 'Default text has no "GSTIN:"');
      assert.strictEqual(
        defaultMessage.includes('+91 98765 43210'),
        false,
        'Default text has no mock "+91 98765 43210"'
      );
      assert.ok(defaultMessage.includes('Sunita Devi'), 'Customer name present');
      assert.ok(defaultMessage.includes('Amlodipine 5mg'), 'Medicine name present');
    }
  );

  // ---------------------------------------------------------------------------
  // STEP 4: Teardown & Restore initial pharmacy settings
  // ---------------------------------------------------------------------------
  logSection('TEARDOWN & SETTINGS RESTORATION');
  try {
    if (originalSettings.length > 0) {
      console.log(`🔄 Restoring ${originalSettings.length} original pharmacy settings...`);
      for (const item of originalSettings) {
        await db.pharmacySetting.upsert({
          where: { key: item.key },
          update: { value: item.value },
          create: { key: item.key, value: item.value },
        });
      }
      console.log('✅ Pharmacy settings restored to pristine initial state.');
    }
  } catch (restoreErr) {
    console.error('❌ Error restoring settings:', restoreErr);
  }

  // ---------------------------------------------------------------------------
  // FINAL SUMMARY REPORT
  // ---------------------------------------------------------------------------
  const total = testResults.length;
  const passed = testResults.filter((t) => t.status === 'PASS').length;
  const failed = testResults.filter((t) => t.status === 'FAIL').length;

  logSection('TEST EXECUTION SUMMARY');
  console.log(`  Total Tests Run : ${total}`);
  console.log(`  Passed          : \x1b[32m${passed}\x1b[0m`);
  console.log(`  Failed          : \x1b[${failed > 0 ? '31' : '32'}m${failed}\x1b[0m`);
  console.log(`---------------------------------------------------------------`);

  if (failed > 0) {
    console.error(`\n❌ FAILED TESTS:`);
    for (const res of testResults.filter((t) => t.status === 'FAIL')) {
      console.error(`  - [${res.testId}] ${res.suite} > ${res.name}: ${res.error}`);
    }
    process.exit(1);
  } else {
    console.log(`\n\x1b[32m🎉 ALL ${passed} TEST CASES PASSED SUCCESSFULLY!\x1b[0m\n`);
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('Unhandled fatal error in test runner:', e);
  process.exit(1);
});
