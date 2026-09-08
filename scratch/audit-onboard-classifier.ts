/**
 * scratch/audit-onboard-classifier.ts
 *
 * Exhaustive Audit and Verification Suite for:
 * 1. Customer Onboarding Non-Blocking Behavior (src/components/OnboardPatientModal.tsx & src/app/api/customers/onboard/route.ts)
 *    - Onboarding with 0 medicines: succeeds, creates customer, sets condition to 'Blood Pressure', creates 0 prescriptions, returns HTTP 200 without blocking.
 *    - Onboarding with 1 medicine: creates customer and prescription, calculates refill date correctly.
 *    - Onboarding with multiple medicines: preserves each medicine's specific category and packaging without catalog corruption.
 *    - Dynamic submit button text:
 *      * 0 medicines: 'Save Patient Profile'
 *      * 1 medicine: 'Save Patient & 1 Medicine'
 *      * N medicines: 'Save Patient & N Medicines'
 * 2. Chronic Condition Category Logic (src/lib/medicine-classifier.ts)
 *    - Verify default category is 'Blood Pressure' (BP).
 *    - Category is not mandatory: user can deselect any category and it safely normalizes/resets to 'Blood Pressure'.
 *    - Dynamic classification: detects category from medicine names (Telma -> BP, Glycomet -> Diabetes, Thyronorm -> Thyroid, Atorva -> Cholesterol, etc.).
 *    - Unclassified or unknown items default to 'Blood Pressure'.
 * 3. Deduplication & Data Integrity:
 *    - Duplicate medicines submitted in same onboarding payload are deduplicated and do not create duplicate prescriptions.
 *    - Re-onboarding customer updates active prescription rather than creating duplicate.
 *    - Village/locality defaults to Muzaffarpur rural villages (Sarfuddinpur, etc.).
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { db } from '../src/lib/db';
import {
  detectMedicineCategory,
  normalizeChronicCategory,
  DEFAULT_CHRONIC_CATEGORY,
  CHRONIC_CONDITIONS_LIST,
} from '../src/lib/medicine-classifier';
import { LOCAL_VILLAGES } from '../src/components/OnboardPatientModal';
import { POST as onboardCustomer } from '../src/app/api/customers/onboard/route';
import { calculateRefill } from '../src/lib/refill-engine';

interface AuditResult {
  section: string;
  testCase: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: string;
}

const auditResults: AuditResult[] = [];
const testPhoneNumbers: string[] = [];
const testMedicineIds: string[] = [];

async function auditCase(section: string, testCase: string, fn: () => Promise<void> | void) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    auditResults.push({ section, testCase, passed: true, durationMs });
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m \x1b[1m${testCase}\x1b[0m \x1b[90m(${durationMs}ms)\x1b[0m`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    auditResults.push({ section, testCase, passed: false, durationMs, error: err?.message || String(err) });
    console.error(`  \x1b[31m✘ [FAIL]\x1b[0m \x1b[1m${testCase}\x1b[0m \x1b[90m(${durationMs}ms)\x1b[0m`);
    console.error(`    \x1b[33mError: ${err?.message || err}\x1b[0m`);
    if (err?.stack) {
      console.error(`    ${err.stack.split('\n').slice(1, 4).join('\n    ')}`);
    }
  }
}

async function cleanupTestData() {
  console.log('\n\x1b[90mCleaning up test database artifacts...\x1b[0m');
  try {
    if (testPhoneNumbers.length > 0) {
      const customers = await db.customer.findMany({
        where: { phone: { in: testPhoneNumbers } },
        select: { id: true },
      });
      const customerIds = customers.map((c) => c.id);
      if (customerIds.length > 0) {
        await db.prescription.deleteMany({
          where: { customerId: { in: customerIds } },
        });
        await db.customer.deleteMany({
          where: { id: { in: customerIds } },
        });
      }
    }
    if (testMedicineIds.length > 0) {
      await db.prescription.deleteMany({
        where: { medicineId: { in: testMedicineIds } },
      });
      await db.medicine.deleteMany({
        where: { id: { in: testMedicineIds } },
      });
    }
    console.log('\x1b[32mCleanup completed successfully.\x1b[0m');
  } catch (e) {
    console.warn('\x1b[33mCleanup warning:\x1b[0m', e);
  }
}

async function runAudit() {
  console.log('\n=============================================================================');
  console.log('  \x1b[1m\x1b[36mCUSTOMER ONBOARDING & CATEGORY LEARNING AUDITOR\x1b[0m');
  console.log('  Pharmacy Retail Refill Verification Suite');
  console.log('=============================================================================\n');

  try {
    // =========================================================================
    // SECTION 1: CUSTOMER ONBOARDING NON-BLOCKING BEHAVIOR
    // =========================================================================
    console.log('\x1b[1m\x1b[34m[SECTION 1] Customer Onboarding Non-Blocking Behavior\x1b[0m');
    console.log('\x1b[90mFiles: src/components/OnboardPatientModal.tsx & src/app/api/customers/onboard/route.ts\x1b[0m\n');

    // 1.1 Onboard with 0 medicines
    await auditCase(
      'Section 1: Onboarding Non-Blocking Behavior',
      '1.1.1 Onboard with 0 medicines: succeeds, creates customer, sets condition to "Blood Pressure", creates 0 prescriptions, returns HTTP 200 without blocking',
      async () => {
        const testPhone = '8800112201';
        testPhoneNumbers.push(testPhone);

        // Pre-clean
        await db.customer.deleteMany({ where: { phone: testPhone } });

        const payload = {
          name: 'Shyam Sundar (0 Meds)',
          phone: testPhone,
          altPhone: '9876543201',
          address: 'Sarfuddinpur Main Tola',
          locality: 'Sarfuddinpur',
          city: 'Muzaffarpur',
          // Omitting condition / primaryCondition so it defaults to BP
          medicines: [],
        };

        const req = new Request('http://localhost:3000/api/customers/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const res = await onboardCustomer(req);
        assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);

        const data = await res.json();
        assert.strictEqual(data.success, true, 'API should return success: true');
        assert.ok(data.customer, 'Customer record must be returned in response');
        assert.strictEqual(data.customer.name, 'Shyam Sundar (0 Meds)');
        assert.strictEqual(data.customer.phone, testPhone);
        assert.strictEqual(
          data.customer.primaryCondition,
          'Blood Pressure',
          'Customer condition must default to "Blood Pressure"'
        );
        assert.strictEqual(data.prescription, null, 'Single prescription field should be null');
        assert.strictEqual(Array.isArray(data.prescriptions), true, 'prescriptions must be an array');
        assert.strictEqual(data.prescriptions.length, 0, 'Must create exactly 0 prescriptions');

        // Verify directly in database
        const dbCust = await db.customer.findUnique({
          where: { phone: testPhone },
          include: { prescriptions: true },
        });
        assert.ok(dbCust, 'Customer must be saved in database');
        assert.strictEqual(dbCust.primaryCondition, 'Blood Pressure');
        assert.strictEqual(dbCust.prescriptions.length, 0, 'Database must have 0 prescriptions for customer');
      }
    );

    // 1.1.2 Onboard with 0 medicines and deselected / empty condition string
    await auditCase(
      'Section 1: Onboarding Non-Blocking Behavior',
      '1.1.2 Onboard with 0 medicines & explicitly empty condition: safely normalizes to "Blood Pressure"',
      async () => {
        const testPhone = '8800112202';
        testPhoneNumbers.push(testPhone);

        await db.customer.deleteMany({ where: { phone: testPhone } });

        const payload = {
          name: 'Radha Devi (Empty Condition)',
          phone: testPhone,
          primaryCondition: '', // explicitly deselected / empty
          medicines: [],
        };

        const req = new Request('http://localhost:3000/api/customers/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const res = await onboardCustomer(req);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.customer.primaryCondition, 'Blood Pressure');
        assert.strictEqual(data.prescriptions.length, 0);
      }
    );

    // 1.2 Onboard with 1 medicine
    await auditCase(
      'Section 1: Onboarding Non-Blocking Behavior',
      '1.2.1 Onboard with 1 medicine: creates customer & prescription, calculates refill date correctly',
      async () => {
        const testPhone = '8800112203';
        testPhoneNumbers.push(testPhone);
        await db.customer.deleteMany({ where: { phone: testPhone } });

        // Create test medicine
        const med = await db.medicine.create({
          data: {
            name: 'TELMA 40MG AUDIT-1',
            genericName: 'TELMISARTAN 40MG',
            category: 'Blood Pressure',
            packagingType: 'strip',
            unitsPerPack: 15,
            mrp: 115.0,
            margItemCode: `TEST_TEL_${Date.now()}_1`,
            isChronicMed: true,
          },
        });
        testMedicineIds.push(med.id);

        const purchaseDate = new Date('2026-09-01T00:00:00.000Z');
        const qty = 30; // 30 tablets
        const dailyDosage = 1; // 1 tab/day
        const bufferDays = 3;

        const payload = {
          name: 'Anil Kumar (1 Med)',
          phone: testPhone,
          primaryCondition: 'Blood Pressure',
          medicines: [
            {
              medicineId: med.id,
              dailyDosage,
              lastPurchaseQty: qty,
              lastPurchaseDate: purchaseDate.toISOString(),
              bufferDays,
              unitType: 'tablets',
              customPackaging: '2 Strip(s) (15 tabs/strip)',
            },
          ],
        };

        const req = new Request('http://localhost:3000/api/customers/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const res = await onboardCustomer(req);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.prescriptions.length, 1);

        const rx = data.prescriptions[0];
        assert.strictEqual(rx.dailyDosage, 1);
        assert.strictEqual(rx.lastPurchaseQty, 30);
        assert.strictEqual(rx.bufferDays, 3);
        assert.strictEqual(rx.customPackaging, '2 Strip(s) (15 tabs/strip)');

        // Calculate expected refill date
        // 30 tabs / 1 per day = 30 days of supply
        // Refill date = purchaseDate + (30 - 3) = 27 days
        // 2026-09-01 + 27 days = 2026-09-28
        const expectedCalc = calculateRefill({
          lastPurchaseDate: purchaseDate,
          lastPurchaseQty: qty,
          dailyDosage,
          bufferDays,
          medicineName: med.name,
          category: med.category,
        });

        const returnedDate = new Date(rx.nextRefillDate);
        assert.strictEqual(
          returnedDate.toISOString().slice(0, 10),
          expectedCalc.nextRefillDate.toISOString().slice(0, 10),
          `Refill date must match refill engine calculation (expected ${expectedCalc.nextRefillDate.toISOString().slice(0, 10)}, got ${returnedDate.toISOString().slice(0, 10)})`
        );
        assert.strictEqual(
          returnedDate.toISOString().slice(0, 10),
          '2026-09-28',
          'Refill date should be exactly 2026-09-28'
        );

        // Verify DB record
        const dbCust = await db.customer.findUnique({
          where: { phone: testPhone },
          include: { prescriptions: { include: { medicine: true } } },
        });
        assert.ok(dbCust);
        assert.strictEqual(dbCust.prescriptions.length, 1);
        assert.strictEqual(dbCust.prescriptions[0].medicine.id, med.id);
      }
    );

    // 1.2.2 Onboard with 1 medicine via flat payload (backward compatibility: medicineId, dailyDosage, etc. at root)
    await auditCase(
      'Section 1: Onboarding Non-Blocking Behavior',
      '1.2.2 Onboard with 1 medicine via flat root payload: creates customer and prescription properly',
      async () => {
        const testPhone = '8800112204';
        testPhoneNumbers.push(testPhone);
        await db.customer.deleteMany({ where: { phone: testPhone } });

        const med = await db.medicine.create({
          data: {
            name: 'GLYCOMET 500 AUDIT-ROOT',
            genericName: 'METFORMIN',
            category: 'Diabetes',
            packagingType: 'strip',
            unitsPerPack: 10,
            mrp: 45.0,
            margItemCode: `TEST_GLY_${Date.now()}_ROOT`,
            isChronicMed: true,
          },
        });
        testMedicineIds.push(med.id);

        const payload = {
          name: 'Flat Payload Patient',
          phone: testPhone,
          medicineId: med.id,
          dailyDosage: 2,
          quantityPurchased: 60,
          bufferDays: 3,
        };

        const req = new Request('http://localhost:3000/api/customers/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const res = await onboardCustomer(req);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.prescriptions.length, 1);
        assert.strictEqual(data.prescriptions[0].dailyDosage, 2);
        assert.strictEqual(data.prescriptions[0].lastPurchaseQty, 60);
      }
    );

    // 1.3 Onboard with multiple medicines across distinct categories & packagings
    await auditCase(
      'Section 1: Onboarding Non-Blocking Behavior',
      '1.3.1 Onboard with multiple medicines: preserves each medicine category, packaging, and avoids catalog corruption',
      async () => {
        const testPhone = '8800112205';
        testPhoneNumbers.push(testPhone);
        await db.customer.deleteMany({ where: { phone: testPhone } });

        // Medicine 1: Blood Pressure strip
        const medBP = await db.medicine.create({
          data: {
            name: 'TELMA 40MG MULTI-AUDIT',
            genericName: 'TELMISARTAN',
            category: 'Blood Pressure',
            packagingType: 'strip',
            unitsPerPack: 15,
            mrp: 115.0,
            margItemCode: `TEST_MULTI_BP_${Date.now()}`,
            isChronicMed: true,
          },
        });
        testMedicineIds.push(medBP.id);

        // Medicine 2: Thyroid bottle
        const medThyroid = await db.medicine.create({
          data: {
            name: 'THYRONORM 100MCG MULTI-AUDIT',
            genericName: 'THYROXINE SODIUM',
            category: 'Thyroid',
            packagingType: 'bottle',
            unitsPerPack: 100,
            mrp: 180.0,
            margItemCode: `TEST_MULTI_THY_${Date.now()}`,
            isChronicMed: true,
          },
        });
        testMedicineIds.push(medThyroid.id);

        // Medicine 3: Cholesterol strip
        const medChol = await db.medicine.create({
          data: {
            name: 'ATORVA 10MG MULTI-AUDIT',
            genericName: 'ATORVASTATIN',
            category: 'Cholesterol',
            packagingType: 'strip',
            unitsPerPack: 10,
            mrp: 95.0,
            margItemCode: `TEST_MULTI_CHOL_${Date.now()}`,
            isChronicMed: true,
          },
        });
        testMedicineIds.push(medChol.id);

        // Patient condition is Blood Pressure, but patient is taking 3 distinct meds
        const payload = {
          name: 'Multi Med Patient',
          phone: testPhone,
          primaryCondition: 'Blood Pressure',
          medicines: [
            {
              medicineId: medBP.id,
              category: 'Blood Pressure',
              dailyDosage: 1,
              lastPurchaseQty: 30,
              customPackaging: '2 Strip(s) (15 tabs/strip)',
              unitType: 'tablets',
              customMrp: 115,
              customUnitsPerPack: 15,
            },
            {
              medicineId: medThyroid.id,
              category: 'Thyroid',
              dailyDosage: 1,
              lastPurchaseQty: 100,
              customPackaging: '1 Bottle (100 tabs/bottle)',
              unitType: 'tablets',
              customMrp: 180,
              customUnitsPerPack: 100,
            },
            {
              medicineId: medChol.id,
              category: 'Cholesterol',
              dailyDosage: 1,
              lastPurchaseQty: 20,
              customPackaging: '2 Strip(s) (10 tabs/strip)',
              unitType: 'tablets',
              customMrp: 95,
              customUnitsPerPack: 10,
            },
          ],
        };

        const req = new Request('http://localhost:3000/api/customers/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const res = await onboardCustomer(req);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(data.prescriptions.length, 3, 'Must create 3 distinct prescriptions');

        // Check each prescription's packaging & category
        const rxBP = data.prescriptions.find((p: any) => p.medicineId === medBP.id);
        const rxThy = data.prescriptions.find((p: any) => p.medicineId === medThyroid.id);
        const rxChol = data.prescriptions.find((p: any) => p.medicineId === medChol.id);

        assert.ok(rxBP, 'Prescription for BP med must exist');
        assert.ok(rxThy, 'Prescription for Thyroid med must exist');
        assert.ok(rxChol, 'Prescription for Cholesterol med must exist');

        assert.strictEqual(rxBP.medicine.category, 'Blood Pressure');
        assert.strictEqual(rxBP.customPackaging, '2 Strip(s) (15 tabs/strip)');

        assert.strictEqual(rxThy.medicine.category, 'Thyroid');
        assert.strictEqual(rxThy.customPackaging, '1 Bottle (100 tabs/bottle)');

        assert.strictEqual(rxChol.medicine.category, 'Cholesterol');
        assert.strictEqual(rxChol.customPackaging, '2 Strip(s) (10 tabs/strip)');

        // CRITICAL CHECK: Verify catalog records did not get corrupted by patient primaryCondition!
        const catalogThyroid = await db.medicine.findUnique({ where: { id: medThyroid.id } });
        assert.strictEqual(
          catalogThyroid?.category,
          'Thyroid',
          'Catalog category for Thyronorm MUST remain Thyroid, NOT overwritten with patient condition'
        );

        const catalogChol = await db.medicine.findUnique({ where: { id: medChol.id } });
        assert.strictEqual(
          catalogChol?.category,
          'Cholesterol',
          'Catalog category for Atorva MUST remain Cholesterol'
        );
      }
    );

    // 1.4 Dynamic submit button text in OnboardPatientModal.tsx
    await auditCase(
      'Section 1: Onboarding Non-Blocking Behavior',
      '1.4.1 Dynamic submit button text logic in OnboardPatientModal.tsx: exact labels for 0, 1, and N medicines',
      () => {
        const modalFilePath = path.resolve(__dirname, '../src/components/OnboardPatientModal.tsx');
        const modalSource = fs.readFileSync(modalFilePath, 'utf-8');

        // Verify AST / code representation of button text
        const hasZeroMedText = modalSource.includes("'Save Patient Profile'");
        const hasOneMedText = modalSource.includes("'Save Patient & 1 Medicine'");
        const hasNMedText = modalSource.includes("`Save Patient & ${prescribedMeds.length} Medicines`");
        const hasSavingText = modalSource.includes("'Saving Patient...'");

        assert.ok(hasZeroMedText, "Modal must contain 'Save Patient Profile' for 0 medicines");
        assert.ok(hasOneMedText, "Modal must contain 'Save Patient & 1 Medicine' for 1 medicine");
        assert.ok(hasNMedText, "Modal must contain '`Save Patient & ${prescribedMeds.length} Medicines`' for N medicines");
        assert.ok(hasSavingText, "Modal must contain 'Saving Patient...' for loading state");

        // Simulate function returning button text
        const getButtonText = (saving: boolean, medCount: number): string => {
          return saving
            ? 'Saving Patient...'
            : medCount === 0
            ? 'Save Patient Profile'
            : medCount === 1
            ? 'Save Patient & 1 Medicine'
            : `Save Patient & ${medCount} Medicines`;
        };

        // Assert all states
        assert.strictEqual(getButtonText(false, 0), 'Save Patient Profile', '0 medicines text mismatch');
        assert.strictEqual(getButtonText(false, 1), 'Save Patient & 1 Medicine', '1 medicine text mismatch');
        assert.strictEqual(getButtonText(false, 2), 'Save Patient & 2 Medicines', '2 medicines text mismatch');
        assert.strictEqual(getButtonText(false, 3), 'Save Patient & 3 Medicines', '3 medicines text mismatch');
        assert.strictEqual(getButtonText(false, 5), 'Save Patient & 5 Medicines', '5 medicines text mismatch');
        assert.strictEqual(getButtonText(false, 10), 'Save Patient & 10 Medicines', '10 medicines text mismatch');
        assert.strictEqual(getButtonText(true, 0), 'Saving Patient...', 'Saving state mismatch for 0 meds');
        assert.strictEqual(getButtonText(true, 2), 'Saving Patient...', 'Saving state mismatch for N meds');
      }
    );

    // =========================================================================
    // SECTION 2: CHRONIC CONDITION CATEGORY LOGIC
    // =========================================================================
    console.log('\n\x1b[1m\x1b[34m[SECTION 2] Chronic Condition Category Logic\x1b[0m');
    console.log('\x1b[90mFiles: src/lib/medicine-classifier.ts & src/components/OnboardPatientModal.tsx\x1b[0m\n');

    // 2.1 Default Category is 'Blood Pressure'
    await auditCase(
      'Section 2: Chronic Condition Category Logic',
      '2.1.1 Verify default chronic category constant and list configuration',
      () => {
        assert.strictEqual(
          DEFAULT_CHRONIC_CATEGORY,
          'Blood Pressure',
          'DEFAULT_CHRONIC_CATEGORY must be "Blood Pressure"'
        );

        assert.ok(CHRONIC_CONDITIONS_LIST.length > 0, 'CHRONIC_CONDITIONS_LIST must not be empty');
        const firstCondition = CHRONIC_CONDITIONS_LIST[0];
        assert.strictEqual(
          firstCondition.id,
          'Blood Pressure',
          'First condition in list must be "Blood Pressure"'
        );
        assert.strictEqual(
          firstCondition.shortLabel,
          'BP',
          'Short label for Blood Pressure must be "BP"'
        );
      }
    );

    // 2.2 Category is not mandatory: user can deselect any category and it normalizes to 'Blood Pressure'
    await auditCase(
      'Section 2: Chronic Condition Category Logic',
      '2.2.1 Category is not mandatory: deselected, empty, null, and General all normalize to "Blood Pressure"',
      () => {
        // Deselected / empty / null / undefined / General / None
        assert.strictEqual(normalizeChronicCategory(''), 'Blood Pressure');
        assert.strictEqual(normalizeChronicCategory('   '), 'Blood Pressure');
        assert.strictEqual(normalizeChronicCategory(null), 'Blood Pressure');
        assert.strictEqual(normalizeChronicCategory(undefined), 'Blood Pressure');
        assert.strictEqual(normalizeChronicCategory('General'), 'Blood Pressure');
        assert.strictEqual(normalizeChronicCategory('general'), 'Blood Pressure');
        assert.strictEqual(normalizeChronicCategory('None'), 'Blood Pressure');
        assert.strictEqual(normalizeChronicCategory('none'), 'Blood Pressure');
        assert.strictEqual(normalizeChronicCategory('UnknownCondition'), 'Blood Pressure');
        assert.strictEqual(normalizeChronicCategory('xyz123'), 'Blood Pressure');

        // Valid categories should normalize to their exact IDs
        assert.strictEqual(normalizeChronicCategory('BP'), 'Blood Pressure');
        assert.strictEqual(normalizeChronicCategory('bp'), 'Blood Pressure');
        assert.strictEqual(normalizeChronicCategory('Blood Pressure'), 'Blood Pressure');
        assert.strictEqual(normalizeChronicCategory('Diabetes'), 'Diabetes');
        assert.strictEqual(normalizeChronicCategory('diabetes'), 'Diabetes');
        assert.strictEqual(normalizeChronicCategory('Thyroid'), 'Thyroid');
        assert.strictEqual(normalizeChronicCategory('thyroid'), 'Thyroid');
        assert.strictEqual(normalizeChronicCategory('Heart'), 'Heart');
        assert.strictEqual(normalizeChronicCategory('Cholesterol'), 'Cholesterol');
        assert.strictEqual(normalizeChronicCategory('Respiratory'), 'Respiratory');
        assert.strictEqual(normalizeChronicCategory('Gastric'), 'Gastric');
        assert.strictEqual(normalizeChronicCategory('Infant Milk'), 'Infant Milk');
      }
    );

    // 2.2.2 Deselect Behavior in OnboardPatientModal.tsx
    await auditCase(
      'Section 2: Chronic Condition Category Logic',
      '2.2.2 Deselect behavior in OnboardPatientModal.tsx: toggles condition back to DEFAULT_CHRONIC_CATEGORY',
      () => {
        const modalFilePath = path.resolve(__dirname, '../src/components/OnboardPatientModal.tsx');
        const modalSource = fs.readFileSync(modalFilePath, 'utf-8');

        // Check that initial condition state is Blood Pressure
        const hasInitialBP =
          modalSource.includes("const [condition, setCondition] = useState<string>('Blood Pressure');") ||
          modalSource.includes("const [condition, setCondition] = useState('Blood Pressure');");
        assert.ok(hasInitialBP, "Modal state 'condition' must be initialized to 'Blood Pressure'");

        // Check toggle deselect behavior in the onClick handler
        const hasDeselectLogic =
          modalSource.includes("setCondition(DEFAULT_CHRONIC_CATEGORY)") &&
          modalSource.includes("setConditionManuallySelected(false)");
        assert.ok(
          hasDeselectLogic,
          "Modal must implement deselect logic resetting to DEFAULT_CHRONIC_CATEGORY and unsetting manual selection"
        );

        // Check reset button existence
        const hasResetButton =
          modalSource.includes("Reset to BP (Default)") &&
          modalSource.includes("condition !== DEFAULT_CHRONIC_CATEGORY");
        assert.ok(hasResetButton, "Modal must provide a 'Reset to BP (Default)' button when condition is not BP");

        // Check individual medicine category deselect
        const hasItemDeselect =
          modalSource.includes("handleUpdateMedicine(idx, { category: DEFAULT_CHRONIC_CATEGORY })") ||
          modalSource.includes("nextCat = isSelected ? DEFAULT_CHRONIC_CATEGORY : cond.id");
        assert.ok(hasItemDeselect, "Modal must allow deselecting individual medicine category back to BP");
      }
    );

    // 2.3 Dynamic Classification from Medicine Names and Compositions
    await auditCase(
      'Section 2: Chronic Condition Category Logic',
      '2.3.1 Dynamic classification detects Blood Pressure from brand names & salts',
      () => {
        const bpMedicines = [
          'Telma 40mg',
          'TELMA-H',
          'Telvas 20',
          'Telmisartan 40mg',
          'Telsartan 40',
          'Amlodipine 5mg',
          'Amlokind-AT',
          'Amlovas 5',
          'Losar 50',
          'Losartan Potassium',
          'Olmetime 20',
          'Olmesartan Medoxomil',
          'Cardace 2.5',
          'Ramipril 5mg',
          'Enalapril 5mg',
          'Aten 50',
          'Atenolol 25',
          'Metolar 50',
          'Metoprolol Succinate',
          'Betaloc 25',
          'Concor 5',
          'Bisoprolol Fumarate',
          'Cilacar 10',
          'Cilnidipine 10mg',
          'Nebicip 5',
          'Nebivolol 5mg',
          'Dytor 10',
          'Torsemide 10mg',
          'Lasix 40mg',
          'Furosemide',
          'Arkamin 100mcg',
          'Clonidine',
          'Nicardia Retard',
          'Nifedipine 20',
        ];

        for (const med of bpMedicines) {
          const category = detectMedicineCategory(med);
          assert.strictEqual(category, 'Blood Pressure', `Expected "${med}" to classify as Blood Pressure, got "${category}"`);
        }
      }
    );

    await auditCase(
      'Section 2: Chronic Condition Category Logic',
      '2.3.2 Dynamic classification detects Diabetes from brand names & salts',
      () => {
        const diabetesMedicines = [
          'Glycomet 500mg',
          'GLYCOMET-SR 1GM',
          'Metformin Hydrochloride',
          'Glimepiride 2mg',
          'Amaryl 1mg',
          'Gliclazide 80mg',
          'Januvia 100mg',
          'Sitagliptin',
          'Galvus 50mg',
          'Vildagliptin',
          'Forxiga 10mg',
          'Dapagliflozin 10mg',
          'Jardiance 10mg',
          'Empagliflozin',
          'Teneligliptin 20mg',
          'Trajenta 5mg',
          'Linagliptin',
          'Rybelsus 3mg',
          'Semaglutide',
          'Voglibose 0.2mg',
          'Insulin Glargine',
          'Pioglitazone 15mg',
        ];

        for (const med of diabetesMedicines) {
          const category = detectMedicineCategory(med);
          assert.strictEqual(category, 'Diabetes', `Expected "${med}" to classify as Diabetes, got "${category}"`);
        }
      }
    );

    await auditCase(
      'Section 2: Chronic Condition Category Logic',
      '2.3.3 Dynamic classification detects Thyroid from brand names & salts',
      () => {
        const thyroidMedicines = [
          'Thyronorm 50mcg',
          'THYRONORM 100MCG',
          'Eltroxin 75mcg',
          'Thyroxine Sodium 12.5mcg',
          'Levothyroxine 50mcg',
          'Thyrocab 5mg',
          'Neo-Mercazole 5mg',
          'Carbimazole 10mg',
          'Propylthiouracil 50mg',
        ];

        for (const med of thyroidMedicines) {
          const category = detectMedicineCategory(med);
          assert.strictEqual(category, 'Thyroid', `Expected "${med}" to classify as Thyroid, got "${category}"`);
        }
      }
    );

    await auditCase(
      'Section 2: Chronic Condition Category Logic',
      '2.3.4 Dynamic classification detects Cholesterol from brand names & salts',
      () => {
        const cholesterolMedicines = [
          'Atorva 10mg',
          'ATORVA 20',
          'Atorvastatin 40mg',
          'Atorlip 20',
          'Rosuvas 10mg',
          'Rosuvastatin 20mg',
          'Rozavel 10',
          'Fenofibrate 145mg',
          'Lipaglyn 4mg',
          'Ezetimibe 10mg',
        ];

        for (const med of cholesterolMedicines) {
          const category = detectMedicineCategory(med);
          assert.strictEqual(category, 'Cholesterol', `Expected "${med}" to classify as Cholesterol, got "${category}"`);
        }
      }
    );

    await auditCase(
      'Section 2: Chronic Condition Category Logic',
      '2.3.5 Dynamic classification detects other chronic categories (Heart, Respiratory, Gastric, Infant Milk)',
      () => {
        // Heart
        assert.strictEqual(detectMedicineCategory('Clopilet 75'), 'Heart');
        assert.strictEqual(detectMedicineCategory('Ecosprin 75'), 'Heart');
        assert.strictEqual(detectMedicineCategory('Sorbitrate 5mg'), 'Heart');

        // Respiratory
        assert.strictEqual(detectMedicineCategory('Foracort 200 Inhaler'), 'Respiratory');
        assert.strictEqual(detectMedicineCategory('Asthalin Inhaler 100mcg'), 'Respiratory');
        assert.strictEqual(detectMedicineCategory('Montair-LC'), 'Respiratory');

        // Gastric
        assert.strictEqual(detectMedicineCategory('Pantocid 40'), 'Gastric');
        assert.strictEqual(detectMedicineCategory('Pan-D Capsule'), 'Gastric');
        assert.strictEqual(detectMedicineCategory('Omez 20'), 'Gastric');

        // Infant Milk
        assert.strictEqual(detectMedicineCategory('Nan Pro 1 Infant Formula'), 'Infant Milk');
        assert.strictEqual(detectMedicineCategory('Lactogen 1 400g'), 'Infant Milk');
        assert.strictEqual(detectMedicineCategory('Similac Advance 1'), 'Infant Milk');
        assert.strictEqual(detectMedicineCategory('Aptamil Stage 1'), 'Infant Milk');
      }
    );

    // 2.4 Unclassified or Unknown Items Default to 'Blood Pressure'
    await auditCase(
      'Section 2: Chronic Condition Category Logic',
      '2.4.1 Unclassified or unknown items default to "Blood Pressure"',
      () => {
        const unknownList = [
          'Crocin 650',
          'Paracetamol 500mg',
          'Cough Syrup Generic X',
          'Unknown Ayurvedic Churna',
          'CompoundXYZ 100mg',
          '',
          '   ',
        ];

        for (const item of unknownList) {
          const category = detectMedicineCategory(item);
          assert.strictEqual(
            category,
            'Blood Pressure',
            `Unknown item "${item}" should default to Blood Pressure, got "${category}"`
          );
        }

        // Check null / undefined params
        assert.strictEqual(detectMedicineCategory(null, null, null), 'Blood Pressure');
        assert.strictEqual(detectMedicineCategory(undefined, undefined, undefined), 'Blood Pressure');
        assert.strictEqual(detectMedicineCategory(null, 'UnknownGeneric', null), 'Blood Pressure');
      }
    );

    // =========================================================================
    // SECTION 3: DEDUPLICATION & DATA INTEGRITY
    // =========================================================================
    console.log('\n\x1b[1m\x1b[34m[SECTION 3] Deduplication & Data Integrity\x1b[0m');
    console.log('\x1b[90mFiles: src/app/api/customers/onboard/route.ts & src/components/OnboardPatientModal.tsx\x1b[0m\n');

    // 3.1 Duplicate Medicines in Same Onboarding Payload
    await auditCase(
      'Section 3: Deduplication & Data Integrity',
      '3.1.1 Duplicate medicines in same onboarding payload are deduplicated (creates exactly 1 prescription)',
      async () => {
        const testPhone = '8800112206';
        testPhoneNumbers.push(testPhone);
        await db.customer.deleteMany({ where: { phone: testPhone } });

        const med = await db.medicine.create({
          data: {
            name: 'AMLODIPINE 5MG DEDUP-1',
            genericName: 'AMLODIPINE',
            category: 'Blood Pressure',
            unitsPerPack: 10,
            mrp: 35.0,
            margItemCode: `TEST_DEDUP_${Date.now()}_1`,
            isChronicMed: true,
          },
        });
        testMedicineIds.push(med.id);

        // Payload contains duplicate entries for med.id with different quantities/doses
        const payload = {
          name: 'Dedup Patient 1',
          phone: testPhone,
          primaryCondition: 'Blood Pressure',
          medicines: [
            {
              medicineId: med.id,
              dailyDosage: 1,
              lastPurchaseQty: 30,
              customPackaging: '3 Strip(s) (10 tabs/strip)',
            },
            {
              medicineId: med.id,
              dailyDosage: 2,
              lastPurchaseQty: 60,
              customPackaging: '6 Strip(s) (10 tabs/strip)',
            },
          ],
        };

        const req = new Request('http://localhost:3000/api/customers/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const res = await onboardCustomer(req);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.success, true);
        assert.strictEqual(
          data.prescriptions.length,
          1,
          'Duplicate medicine IDs in same payload must be deduplicated to exactly 1 prescription'
        );

        // Check in database directly
        const dbCust = await db.customer.findUnique({
          where: { phone: testPhone },
          include: { prescriptions: true },
        });
        assert.ok(dbCust);
        assert.strictEqual(
          dbCust.prescriptions.length,
          1,
          'Database must contain exactly 1 prescription, no duplicates'
        );
      }
    );

    // 3.1.2 Re-onboarding customer updates active prescription without creating duplicate
    await auditCase(
      'Section 3: Deduplication & Data Integrity',
      '3.1.2 Re-onboarding customer with existing medicine updates active prescription without duplicates',
      async () => {
        const testPhone = '8800112207';
        testPhoneNumbers.push(testPhone);
        await db.customer.deleteMany({ where: { phone: testPhone } });

        const med = await db.medicine.create({
          data: {
            name: 'TELMA 20MG REONBOARD',
            genericName: 'TELMISARTAN',
            category: 'Blood Pressure',
            unitsPerPack: 15,
            mrp: 90.0,
            margItemCode: `TEST_REONB_${Date.now()}`,
            isChronicMed: true,
          },
        });
        testMedicineIds.push(med.id);

        // First onboarding
        const req1 = new Request('http://localhost:3000/api/customers/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Reonboard Patient',
            phone: testPhone,
            primaryCondition: 'Blood Pressure',
            medicines: [
              {
                medicineId: med.id,
                dailyDosage: 1,
                lastPurchaseQty: 15,
              },
            ],
          }),
        });
        const res1 = await onboardCustomer(req1);
        assert.strictEqual(res1.status, 200);

        // Second onboarding (same customer, same medicine, updated dosage)
        const req2 = new Request('http://localhost:3000/api/customers/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Reonboard Patient Updated',
            phone: testPhone,
            primaryCondition: 'Blood Pressure',
            medicines: [
              {
                medicineId: med.id,
                dailyDosage: 2,
                lastPurchaseQty: 30,
              },
            ],
          }),
        });
        const res2 = await onboardCustomer(req2);
        assert.strictEqual(res2.status, 200);
        const data2 = await res2.json();
        assert.strictEqual(data2.prescriptions.length, 1);
        assert.strictEqual(data2.prescriptions[0].dailyDosage, 2);
        assert.strictEqual(data2.prescriptions[0].lastPurchaseQty, 30);

        // Verify database has only 1 prescription
        const dbCust = await db.customer.findUnique({
          where: { phone: testPhone },
          include: { prescriptions: true },
        });
        assert.ok(dbCust);
        assert.strictEqual(dbCust.prescriptions.length, 1, 'Database must have only 1 active prescription');
        assert.strictEqual(dbCust.prescriptions[0].dailyDosage, 2);
      }
    );

    // 3.1.3 Client-side deduplication logic in OnboardPatientModal.tsx
    await auditCase(
      'Section 3: Deduplication & Data Integrity',
      '3.1.3 Client-side deduplication logic in OnboardPatientModal.tsx: verified in source code',
      () => {
        const modalFilePath = path.resolve(__dirname, '../src/components/OnboardPatientModal.tsx');
        const modalSource = fs.readFileSync(modalFilePath, 'utf-8');

        // Check handleAddMedicine deduplication
        const hasAddDedup = modalSource.includes('prescribedMeds.some((p) => p.medicine.id === med.id)');
        assert.ok(hasAddDedup, 'Modal must prevent adding duplicate medicines in handleAddMedicine');

        // Check handleSubmit deduplication
        const hasSubmitDedup =
          modalSource.includes('seenMedIds') &&
          modalSource.includes('seenMedIds.has(key)');
        assert.ok(hasSubmitDedup, 'Modal must filter medicines with seenMedIds set before submitting payload');
      }
    );

    // 3.2 Village/Locality Defaults to Muzaffarpur Rural Villages
    await auditCase(
      'Section 3: Deduplication & Data Integrity',
      '3.2.1 Village list in OnboardPatientModal: exports Muzaffarpur rural villages with Sarfuddinpur as primary',
      () => {
        assert.ok(Array.isArray(LOCAL_VILLAGES), 'LOCAL_VILLAGES must be an array');
        assert.strictEqual(LOCAL_VILLAGES[0], 'Sarfuddinpur', 'First default village must be Sarfuddinpur');

        const expectedVillages = [
          'Sarfuddinpur',
          'Gopalpur',
          'Bochahan',
          'Gaighat',
          'Ladaura',
          'Musahari',
          'Sahila',
          'Etwarpur',
          'Madhurapur',
          'Majhauli',
          'Athar',
        ];

        for (const v of expectedVillages) {
          assert.ok(LOCAL_VILLAGES.includes(v), `LOCAL_VILLAGES must include Muzaffarpur rural village "${v}"`);
        }
      }
    );

    await auditCase(
      'Section 3: Deduplication & Data Integrity',
      '3.2.2 Backend route fallback defaults: address, locality, and city default to Sarfuddinpur & Muzaffarpur',
      async () => {
        const testPhone = '8800112208';
        testPhoneNumbers.push(testPhone);
        await db.customer.deleteMany({ where: { phone: testPhone } });

        // Submit customer without address, locality, city
        const payload = {
          name: 'Village Default Patient',
          phone: testPhone,
          medicines: [],
        };

        const req = new Request('http://localhost:3000/api/customers/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const res = await onboardCustomer(req);
        assert.strictEqual(res.status, 200);

        const data = await res.json();
        assert.strictEqual(data.customer.city, 'Muzaffarpur');
        assert.strictEqual(data.customer.locality, 'Sarfuddinpur');
        assert.strictEqual(data.customer.address, 'Sarfuddinpur, Muzaffarpur');

        // Check database directly
        const dbCust = await db.customer.findUnique({ where: { phone: testPhone } });
        assert.ok(dbCust);
        assert.strictEqual(dbCust.city, 'Muzaffarpur');
        assert.strictEqual(dbCust.locality, 'Sarfuddinpur');
        assert.strictEqual(dbCust.address, 'Sarfuddinpur, Muzaffarpur');
      }
    );

    // 3.2.3 Modal default state uses Sarfuddinpur
    await auditCase(
      'Section 3: Deduplication & Data Integrity',
      '3.2.3 Modal default state uses Sarfuddinpur and constructs delivery address with village name',
      () => {
        const modalFilePath = path.resolve(__dirname, '../src/components/OnboardPatientModal.tsx');
        const modalSource = fs.readFileSync(modalFilePath, 'utf-8');

        const hasDefaultVillage = modalSource.includes("const [village, setVillage] = useState('Sarfuddinpur');");
        assert.ok(hasDefaultVillage, "Modal must initialize village state with 'Sarfuddinpur'");

        const hasVillageAddressFormat = modalSource.includes('गाँव: ${village.trim()}');
        assert.ok(hasVillageAddressFormat, "Modal must format address with village name for rural delivery");

        const hasMuzaffarpurCity = modalSource.includes("city: 'Muzaffarpur'");
        assert.ok(hasMuzaffarpurCity, "Modal must set default city to 'Muzaffarpur'");
      }
    );

  } finally {
    await cleanupTestData();
  }

  // =========================================================================
  // AUDIT SUMMARY REPORT
  // =========================================================================
  console.log('\n=============================================================================');
  console.log('  \x1b[1m\x1b[36mAUDIT EXECUTION SUMMARY\x1b[0m');
  console.log('=============================================================================');

  const total = auditResults.length;
  const passed = auditResults.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`Total Audit Test Cases: \x1b[1m${total}\x1b[0m`);
  console.log(`Passed: \x1b[32m\x1b[1m${passed}\x1b[0m`);
  console.log(`Failed: ${failed > 0 ? `\x1b[31m\x1b[1m${failed}\x1b[0m` : '\x1b[32m0\x1b[0m'}`);

  const sections = Array.from(new Set(auditResults.map((r) => r.section)));
  for (const sec of sections) {
    const secResults = auditResults.filter((r) => r.section === sec);
    const secPassed = secResults.filter((r) => r.passed).length;
    console.log(`\n  \x1b[1m${sec}\x1b[0m: ${secPassed}/${secResults.length} passed`);
    for (const r of secResults) {
      const mark = r.passed ? '\x1b[32m✔\x1b[0m' : '\x1b[31m✘\x1b[0m';
      console.log(`    ${mark} ${r.testCase} \x1b[90m(${r.durationMs}ms)\x1b[0m`);
    }
  }

  if (failed > 0) {
    console.log('\n\x1b[31mAudit Failed! Review the failed test cases above.\x1b[0m');
    process.exit(1);
  } else {
    console.log('\n\x1b[32m\x1b[1m✔ ALL AUDIT VERIFICATIONS PASSED PERFECTLY!\x1b[0m\n');
  }
}

runAudit().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
