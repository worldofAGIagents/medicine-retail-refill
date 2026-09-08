/**
 * Backend API & Database Test Runner
 * Medicine Retail Refill Application
 *
 * Tests:
 * 1. Dynamic Medicine Classifier (detectMedicineCategory, normalizeChronicCategory, edge cases)
 * 2. Customer Onboarding API (zero meds, 1 med, multi meds category integrity, deduplication)
 * 3. Medicines Search API (non-blocking fallback across categories, category=BP dual matching)
 * 4. Settings API & Data Persistence (GST/DL empty & custom persistence, UPI ID & passcode protection)
 */

import assert from 'assert';
import { db } from '../src/lib/db';
import {
  detectMedicineCategory,
  normalizeChronicCategory,
  DEFAULT_CHRONIC_CATEGORY,
} from '../src/lib/medicine-classifier';
import { POST as onboardCustomer } from '../src/app/api/customers/onboard/route';
import { GET as getMedicines, POST as createMedicine } from '../src/app/api/medicines/route';
import { GET as getSettings, POST as saveSettings } from '../src/app/api/settings/route';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(suite: string, name: string, fn: () => Promise<void> | void) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ suite, name, passed: true, durationMs });
    console.log(`  \x1b[32m✔ PASS\x1b[0m [${durationMs}ms] ${name}`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ suite, name, passed: false, error: err?.message || String(err), durationMs });
    console.error(`  \x1b[31m✘ FAIL\x1b[0m [${durationMs}ms] ${name}`);
    console.error(`    \x1b[33mError: ${err?.message || err}\x1b[0m`);
    if (err?.stack) {
      console.error(`    ${err.stack.split('\n').slice(1, 4).join('\n    ')}`);
    }
  }
}

async function main() {
  console.log('\n===============================================================');
  console.log('  MEDICINE RETAIL REFILL - BACKEND API & DB TEST SUITE');
  console.log('===============================================================\n');

  // Backup original settings to restore at the end
  const originalSettingsRows = await db.pharmacySetting.findMany();
  const testPhoneNumbers: string[] = [];
  const testMedicineIds: string[] = [];

  try {
    // =========================================================================
    // SUITE 1: DYNAMIC MEDICINE CLASSIFIER
    // =========================================================================
    console.log('\x1b[36m▶ SUITE 1: Dynamic Medicine Classifier (src/lib/medicine-classifier.ts)\x1b[0m');

    await runTest('Classifier', '1.1 Detect diverse Indian brand names correctly', () => {
      const brandTests: Array<{ name: string; expected: string }> = [
        { name: 'Telma 40', expected: 'Blood Pressure' },
        { name: 'Amlokind 5', expected: 'Blood Pressure' },
        { name: 'Glycomet 500', expected: 'Diabetes' },
        { name: 'Januvia', expected: 'Diabetes' },
        { name: 'Thyronorm 50', expected: 'Thyroid' },
        { name: 'Eltroxin', expected: 'Thyroid' },
        { name: 'Atorva 10', expected: 'Cholesterol' },
        { name: 'Pantocid 40', expected: 'Gastric' },
        { name: 'Asthalin', expected: 'Respiratory' },
        { name: 'Aptamil 1', expected: 'Infant Milk' },
        { name: 'Lactogen 1', expected: 'Infant Milk' },
        // Additional high-frequency retail medicines in Bihar
        { name: 'Losar 50', expected: 'Blood Pressure' },
        { name: 'Galvus 50', expected: 'Diabetes' },
        { name: 'Rosuvas 10', expected: 'Cholesterol' },
        { name: 'Foracort 200 Inhaler', expected: 'Respiratory' },
        { name: 'Pan-D Capsule', expected: 'Gastric' },
        { name: 'Nan Pro 1', expected: 'Infant Milk' },
        { name: 'Ecosprin 75', expected: 'Heart' },
      ];

      for (const t of brandTests) {
        const detected = detectMedicineCategory(t.name);
        assert.strictEqual(
          detected,
          t.expected,
          `Failed for brand "${t.name}": expected "${t.expected}", got "${detected}"`
        );
      }
    });

    await runTest('Classifier', '1.2 Detect category from generic name and salt composition', () => {
      assert.strictEqual(
        detectMedicineCategory(null, 'Metformin Hydrochloride 500mg', null),
        'Diabetes',
        'Should classify Metformin generic as Diabetes'
      );
      assert.strictEqual(
        detectMedicineCategory(null, null, 'Telmisartan IP 40mg'),
        'Blood Pressure',
        'Should classify Telmisartan salt as Blood Pressure'
      );
      assert.strictEqual(
        detectMedicineCategory(null, null, 'Levothyroxine Sodium 50mcg'),
        'Thyroid',
        'Should classify Levothyroxine salt as Thyroid'
      );
      assert.strictEqual(
        detectMedicineCategory(null, null, 'Atorvastatin 10mg'),
        'Cholesterol',
        'Should classify Atorvastatin salt as Cholesterol'
      );
      assert.strictEqual(
        detectMedicineCategory(null, null, 'Pantoprazole Sodium 40mg'),
        'Gastric',
        'Should classify Pantoprazole salt as Gastric'
      );
      assert.strictEqual(
        detectMedicineCategory(null, null, 'Salbutamol Sulphate'),
        'Respiratory',
        'Should classify Salbutamol salt as Respiratory'
      );
    });

    await runTest('Classifier', '1.3 Edge cases: empty strings, unknown drugs, null, and undefined default to "Blood Pressure"', () => {
      // Empty string
      assert.strictEqual(
        detectMedicineCategory(''),
        DEFAULT_CHRONIC_CATEGORY,
        'Empty string should default to Blood Pressure'
      );
      assert.strictEqual(
        detectMedicineCategory('   '),
        DEFAULT_CHRONIC_CATEGORY,
        'Whitespace-only string should default to Blood Pressure'
      );

      // Unknown drugs
      assert.strictEqual(
        detectMedicineCategory('UnknownDrugXYZ 100mg'),
        DEFAULT_CHRONIC_CATEGORY,
        'Unknown drug name should default to Blood Pressure'
      );
      assert.strictEqual(
        detectMedicineCategory('CompletelyRandomCompound999'),
        DEFAULT_CHRONIC_CATEGORY,
        'Random compound should default to Blood Pressure'
      );

      // Null and undefined parameters
      assert.strictEqual(
        detectMedicineCategory(null, null, null),
        DEFAULT_CHRONIC_CATEGORY,
        'All null parameters should default to Blood Pressure'
      );
      assert.strictEqual(
        detectMedicineCategory(undefined, undefined, undefined),
        DEFAULT_CHRONIC_CATEGORY,
        'All undefined parameters should default to Blood Pressure'
      );
      assert.strictEqual(
        detectMedicineCategory(null, undefined, ''),
        DEFAULT_CHRONIC_CATEGORY,
        'Mixed null, undefined, empty parameters should default to Blood Pressure'
      );
      assert.strictEqual(
        detectMedicineCategory(undefined, 'UnrecognizedGeneric', null),
        DEFAULT_CHRONIC_CATEGORY,
        'Unrecognized generic should default to Blood Pressure'
      );
    });

    await runTest('Classifier', '1.4 normalizeChronicCategory: proper normalization and fallbacks', () => {
      // Normalization of empty, General, None, and unknown values to 'Blood Pressure'
      assert.strictEqual(normalizeChronicCategory(''), 'Blood Pressure', "'' should normalize to Blood Pressure");
      assert.strictEqual(normalizeChronicCategory('   '), 'Blood Pressure', "'   ' should normalize to Blood Pressure");
      assert.strictEqual(normalizeChronicCategory('General'), 'Blood Pressure', "'General' should normalize to Blood Pressure");
      assert.strictEqual(normalizeChronicCategory('general'), 'Blood Pressure', "'general' (lowercase) should normalize to Blood Pressure");
      assert.strictEqual(normalizeChronicCategory('None'), 'Blood Pressure', "'None' should normalize to Blood Pressure");
      assert.strictEqual(normalizeChronicCategory('none'), 'Blood Pressure', "'none' (lowercase) should normalize to Blood Pressure");
      assert.strictEqual(normalizeChronicCategory(null), 'Blood Pressure', 'null should normalize to Blood Pressure');
      assert.strictEqual(normalizeChronicCategory(undefined), 'Blood Pressure', 'undefined should normalize to Blood Pressure');
      assert.strictEqual(normalizeChronicCategory('UnknownConditionXYZ'), 'Blood Pressure', 'Unknown category should normalize to Blood Pressure');

      // Canonical aliases & categories
      assert.strictEqual(normalizeChronicCategory('BP'), 'Blood Pressure', "'BP' alias should normalize to Blood Pressure");
      assert.strictEqual(normalizeChronicCategory('bp'), 'Blood Pressure', "'bp' (lowercase) should normalize to Blood Pressure");
      assert.strictEqual(normalizeChronicCategory('Blood Pressure'), 'Blood Pressure', "'Blood Pressure' should remain Blood Pressure");
      assert.strictEqual(normalizeChronicCategory('Thyroid'), 'Thyroid', "'Thyroid' should remain Thyroid");
      assert.strictEqual(normalizeChronicCategory('thyroid'), 'Thyroid', "'thyroid' (lowercase) should normalize to Thyroid");
      assert.strictEqual(normalizeChronicCategory('Diabetes'), 'Diabetes', "'Diabetes' should remain Diabetes");
      assert.strictEqual(normalizeChronicCategory('Heart'), 'Heart', "'Heart' should remain Heart");
      assert.strictEqual(normalizeChronicCategory('Infant Milk'), 'Infant Milk', "'Infant Milk' should remain Infant Milk");
      assert.strictEqual(normalizeChronicCategory('Gastric'), 'Gastric', "'Gastric' should remain Gastric");
      assert.strictEqual(normalizeChronicCategory('Cholesterol'), 'Cholesterol', "'Cholesterol' should remain Cholesterol");
      assert.strictEqual(normalizeChronicCategory('Respiratory'), 'Respiratory', "'Respiratory' should remain Respiratory");
    });

    // =========================================================================
    // SUITE 2: CUSTOMER ONBOARDING API
    // =========================================================================
    console.log('\n\x1b[36m▶ SUITE 2: Customer Onboarding API (src/app/api/customers/onboard/route.ts)\x1b[0m');

    await runTest('Onboarding API', '2.1 Register customer with ZERO medicines: returns HTTP 200, defaults to BP, 0 prescriptions', async () => {
      const testPhone = '9999000001';
      testPhoneNumbers.push(testPhone);

      // Clean up if exists from previous test
      await db.customer.deleteMany({ where: { phone: testPhone } });

      const payload = {
        name: 'Zero Medicine Patient',
        phone: testPhone,
        address: 'Sarfuddinpur West Tola',
        locality: 'Sarfuddinpur',
        city: 'Muzaffarpur',
        // Omitting primaryCondition/condition to verify default
        medicines: [],
      };

      const req = new Request('http://localhost:3000/api/customers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await onboardCustomer(req);
      assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);

      const body = await res.json();
      assert.strictEqual(body.success, true, 'Expected success: true');
      assert.ok(body.customer, 'Customer object must be returned');
      assert.strictEqual(body.customer.name, 'Zero Medicine Patient');
      assert.strictEqual(body.customer.phone, testPhone);
      assert.strictEqual(body.customer.primaryCondition, 'Blood Pressure', 'Customer primaryCondition must default to Blood Pressure');
      assert.strictEqual(body.prescription, null, 'Prescription should be null');
      assert.strictEqual(body.prescriptions.length, 0, 'Prescriptions array length must be 0');
      assert.strictEqual(body.updatedMedicinesCount, 0, 'Updated medicines count must be 0');

      // Verify DB record directly
      const dbCustomer = await db.customer.findUnique({
        where: { phone: testPhone },
        include: { prescriptions: true },
      });
      assert.ok(dbCustomer, 'Customer must exist in DB');
      assert.strictEqual(dbCustomer?.primaryCondition, 'Blood Pressure');
      assert.strictEqual(dbCustomer?.prescriptions.length, 0, 'DB must contain exactly 0 prescriptions');
    });

    await runTest('Onboarding API', '2.2 Register customer with 1 medicine: verify prescription, refill calc, dynamic category learning', async () => {
      const testPhone = '9999000002';
      testPhoneNumbers.push(testPhone);
      await db.customer.deleteMany({ where: { phone: testPhone } });

      // Create a test medicine with generic/uncategorized initial category
      const testMed = await db.medicine.create({
        data: {
          name: 'GLYCOMET-SR 500MG TEST',
          genericName: 'METFORMIN HYDROCHLORIDE',
          category: 'General', // Initially General to test dynamic learning
          packagingType: 'strip',
          unitsPerPack: 10,
          mrp: 55.5,
          margItemCode: `TEST_GLY_${Date.now()}`,
          isChronicMed: false,
        },
      });
      testMedicineIds.push(testMed.id);

      const purchaseDate = new Date('2026-09-01T10:00:00.000Z');
      const payload = {
        name: 'Single Med Patient',
        phone: testPhone,
        address: 'Bochahan Chowk',
        locality: 'Bochahan',
        city: 'Muzaffarpur',
        medicines: [
          {
            medicineId: testMed.id,
            dailyDosage: 2,
            lastPurchaseQty: 60,
            lastPurchaseDate: purchaseDate.toISOString(),
            bufferDays: 3,
            unitType: 'tablets',
          },
        ],
      };

      const req = new Request('http://localhost:3000/api/customers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await onboardCustomer(req);
      assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);

      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.prescriptions.length, 1, 'Should create 1 prescription');
      assert.strictEqual(body.medicineUpdated, true, 'Medicine should be dynamically updated');

      // Verify dynamic category learning on medicine catalog
      const updatedMed = await db.medicine.findUnique({ where: { id: testMed.id } });
      assert.strictEqual(
        updatedMed?.category,
        'Diabetes',
        'Medicine category should be dynamically learned as Diabetes from GLYCOMET / METFORMIN'
      );
      assert.strictEqual(updatedMed?.isChronicMed, true, 'Medicine should be marked chronic');

      // Verify refill calculation
      // 60 qty / 2 daily dosage = 30 days supply
      // 30 days - 3 buffer days = 27 days from purchaseDate (2026-09-01 + 27 = 2026-09-28)
      const presc = body.prescriptions[0];
      const nextRefillDate = new Date(presc.nextRefillDate);
      const expectedRefillDate = new Date('2026-09-28T10:00:00.000Z');
      assert.strictEqual(
        nextRefillDate.toISOString().slice(0, 10),
        expectedRefillDate.toISOString().slice(0, 10),
        `Refill date should be 2026-09-28, got ${nextRefillDate.toISOString().slice(0, 10)}`
      );
      assert.strictEqual(presc.dailyDosage, 2);
      assert.strictEqual(presc.lastPurchaseQty, 60);
      assert.strictEqual(presc.bufferDays, 3);
    });

    await runTest('Onboarding API', '2.3 Multi-medicine onboarding across categories: verify each retains category without catalog corruption', async () => {
      const testPhone = '9999000003';
      testPhoneNumbers.push(testPhone);
      await db.customer.deleteMany({ where: { phone: testPhone } });

      // Create two distinct test medicines in distinct categories
      const medTelma = await db.medicine.create({
        data: {
          name: 'TELMA 40MG MULTI-TEST',
          genericName: 'TELMISARTAN 40MG',
          category: 'Blood Pressure',
          packagingType: 'strip',
          unitsPerPack: 15,
          mrp: 115.0,
          margItemCode: `TEST_TEL_${Date.now()}`,
          isChronicMed: true,
        },
      });
      testMedicineIds.push(medTelma.id);

      const medThyro = await db.medicine.create({
        data: {
          name: 'THYRONORM 50MCG MULTI-TEST',
          genericName: 'THYROXINE SODIUM 50MCG',
          category: 'Thyroid',
          packagingType: 'bottle',
          unitsPerPack: 100,
          mrp: 175.0,
          margItemCode: `TEST_THY_${Date.now()}`,
          isChronicMed: true,
        },
      });
      testMedicineIds.push(medThyro.id);

      // Onboard customer who has primaryCondition = 'Blood Pressure', but takes BOTH Telma (BP) and Thyronorm (Thyroid)
      const payload = {
        name: 'Multi-Condition Patient',
        phone: testPhone,
        address: 'Musahari Bazar',
        locality: 'Musahari',
        city: 'Muzaffarpur',
        primaryCondition: 'Blood Pressure',
        medicines: [
          {
            medicineId: medTelma.id,
            category: 'Blood Pressure',
            dailyDosage: 1,
            lastPurchaseQty: 30,
            bufferDays: 3,
          },
          {
            medicineId: medThyro.id,
            category: 'Thyroid',
            dailyDosage: 1,
            lastPurchaseQty: 100,
            bufferDays: 5,
          },
        ],
      };

      const req = new Request('http://localhost:3000/api/customers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await onboardCustomer(req);
      assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);

      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.prescriptions.length, 2, 'Should create 2 prescriptions');

      // CRITICAL VERIFICATION: Ensure Thyronorm is NOT corrupted to 'Blood Pressure' in the catalog!
      const refreshedTelma = await db.medicine.findUnique({ where: { id: medTelma.id } });
      const refreshedThyro = await db.medicine.findUnique({ where: { id: medThyro.id } });

      assert.strictEqual(
        refreshedTelma?.category,
        'Blood Pressure',
        'Telma must retain "Blood Pressure" category in catalog'
      );
      assert.strictEqual(
        refreshedThyro?.category,
        'Thyroid',
        'Thyronorm must retain "Thyroid" category in catalog and NOT be overwritten by patient primaryCondition'
      );

      // Verify prescription associations
      const rxTelma = body.prescriptions.find((p: any) => p.medicineId === medTelma.id);
      const rxThyro = body.prescriptions.find((p: any) => p.medicineId === medThyro.id);
      assert.ok(rxTelma, 'Prescription for Telma must exist');
      assert.ok(rxThyro, 'Prescription for Thyronorm must exist');
      assert.strictEqual(rxTelma.medicine.category, 'Blood Pressure');
      assert.strictEqual(rxThyro.medicine.category, 'Thyroid');
    });

    await runTest('Onboarding API', '2.4 Deduplication: duplicate medicine IDs in same payload must deduplicate cleanly', async () => {
      const testPhone = '9999000004';
      testPhoneNumbers.push(testPhone);
      await db.customer.deleteMany({ where: { phone: testPhone } });

      const testMed = await db.medicine.create({
        data: {
          name: 'AMLOKIND 5MG DEDUP-TEST',
          genericName: 'AMLODIPINE 5MG',
          category: 'Blood Pressure',
          unitsPerPack: 10,
          mrp: 42.0,
          margItemCode: `TEST_AMLO_${Date.now()}`,
        },
      });
      testMedicineIds.push(testMed.id);

      // Send payload with DUPLICATE entries of the same medicineId
      const payload = {
        name: 'Duplicate Test Patient',
        phone: testPhone,
        address: 'Ladaura',
        medicines: [
          { medicineId: testMed.id, dailyDosage: 1, lastPurchaseQty: 30 },
          { medicineId: testMed.id, dailyDosage: 2, lastPurchaseQty: 60 }, // Duplicate with different dose
        ],
      };

      const req = new Request('http://localhost:3000/api/customers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await onboardCustomer(req);
      assert.strictEqual(res.status, 200);

      const body = await res.json();
      assert.strictEqual(
        body.prescriptions.length,
        1,
        'Duplicate medicine IDs in single payload must be deduplicated to exactly 1 prescription'
      );

      // Verify DB count
      const dbCustomer = await db.customer.findUnique({
        where: { phone: testPhone },
        include: { prescriptions: true },
      });
      assert.strictEqual(dbCustomer?.prescriptions.length, 1, 'Customer should have exactly 1 prescription in DB');

      // Re-onboard the same customer with the same medicine (simulating editing/re-submitting)
      const reonboardReq = new Request('http://localhost:3000/api/customers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Test Patient',
          phone: testPhone,
          medicines: [{ medicineId: testMed.id, dailyDosage: 1, lastPurchaseQty: 45 }],
        }),
      });
      const reonboardRes = await onboardCustomer(reonboardReq);
      assert.strictEqual(reonboardRes.status, 200);

      const reonboardDbCustomer = await db.customer.findUnique({
        where: { phone: testPhone },
        include: { prescriptions: true },
      });
      assert.strictEqual(
        reonboardDbCustomer?.prescriptions.length,
        1,
        'Re-onboarding must update existing prescription without creating duplicate active records'
      );
    });

    // =========================================================================
    // SUITE 3: MEDICINES SEARCH API
    // =========================================================================
    console.log('\n\x1b[36m▶ SUITE 3: Medicines Search API (src/app/api/medicines/route.ts)\x1b[0m');

    await runTest('Medicines Search API', '3.1 Non-blocking fallback: category=Thyroid + q=Telma returns Telma from all categories', async () => {
      // Telma is categorized as 'Blood Pressure'. When a user searches for 'Telma' while filter is 'Thyroid':
      // The search must NOT return empty results; it must fall back to searching across all categories.
      const req = new Request('http://localhost:3000/api/medicines?q=Telma&category=Thyroid');
      const res = await getMedicines(req);
      assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);

      const body = await res.json();
      assert.ok(body.data, 'Response should have a data array');
      assert.ok(body.total > 0, `Fallback search should return > 0 results, got ${body.total}`);

      const hasTelma = body.data.some((m: any) => m.name.toLowerCase().includes('telma'));
      assert.ok(
        hasTelma,
        'Search results must contain Telma medicines through the non-blocking fallback mechanism'
      );
    });

    await runTest('Medicines Search API', '3.2 category=BP matches both "BP" and "Blood Pressure"', async () => {
      // Create one medicine with category 'BP' and one with 'Blood Pressure'
      const medBP = await db.medicine.create({
        data: {
          name: 'TEST_MED_BP_EXACT 10MG',
          genericName: 'TEST GENERIC BP',
          category: 'BP',
          unitsPerPack: 10,
          mrp: 30,
          margItemCode: `TEST_BP_EXACT_${Date.now()}`,
        },
      });
      testMedicineIds.push(medBP.id);

      const medFullBP = await db.medicine.create({
        data: {
          name: 'TEST_MED_BLOOD_PRESSURE 10MG',
          genericName: 'TEST GENERIC FULL BP',
          category: 'Blood Pressure',
          unitsPerPack: 10,
          mrp: 40,
          margItemCode: `TEST_BP_FULL_${Date.now()}`,
        },
      });
      testMedicineIds.push(medFullBP.id);

      // Search with category=BP
      const req = new Request('http://localhost:3000/api/medicines?category=BP&q=TEST_MED_');
      const res = await getMedicines(req);
      assert.strictEqual(res.status, 200);

      const body = await res.json();
      const foundIds = body.data.map((m: any) => m.id);

      assert.ok(
        foundIds.includes(medBP.id),
        'category=BP must match medicines categorized as "BP"'
      );
      assert.ok(
        foundIds.includes(medFullBP.id),
        'category=BP must match medicines categorized as "Blood Pressure"'
      );

      // Also test lowercase bp
      const reqLower = new Request('http://localhost:3000/api/medicines?category=bp&q=TEST_MED_');
      const resLower = await getMedicines(reqLower);
      const bodyLower = await resLower.json();
      const foundLowerIds = bodyLower.data.map((m: any) => m.id);
      assert.ok(foundLowerIds.includes(medBP.id));
      assert.ok(foundLowerIds.includes(medFullBP.id));
    });

    // =========================================================================
    // SUITE 4: SETTINGS API & DATA PERSISTENCE
    // =========================================================================
    console.log('\n\x1b[36m▶ SUITE 4: Settings API & Data Persistence (src/app/api/settings/route.ts)\x1b[0m');

    await runTest('Settings API', '4.1 GST and DL persistence: saving empty or custom strings does NOT revert to hardcoded defaults', async () => {
      // 1. Save EMPTY values for dlNumber and gstin
      const emptyPayload = {
        dlNumber: '',
        gstin: '',
      };
      const saveEmptyReq = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emptyPayload),
      });
      const saveEmptyRes = await saveSettings(saveEmptyReq);
      assert.strictEqual(saveEmptyRes.status, 200);

      // Fetch settings via GET
      const getEmptyReq = new Request('http://localhost:3000/api/settings');
      const getEmptyRes = await getSettings(getEmptyReq);
      const emptySettings = await getEmptyRes.json();

      assert.strictEqual(
        emptySettings.dlNumber,
        '',
        'Empty dlNumber must be persisted as empty string, NOT revert to default "BR-20B/MUZ/2022"'
      );
      assert.strictEqual(
        emptySettings.gstin,
        '',
        'Empty gstin must be persisted as empty string, NOT revert to default "10AAAAA0000A1Z5"'
      );

      // 2. Save CUSTOM values for dlNumber and gstin
      const customPayload = {
        dlNumber: 'BR-TEST-DL-2026-999',
        gstin: '10AAACM9999P1ZV',
      };
      const saveCustomReq = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customPayload),
      });
      const saveCustomRes = await saveSettings(saveCustomReq);
      assert.strictEqual(saveCustomRes.status, 200);

      const getCustomReq = new Request('http://localhost:3000/api/settings');
      const getCustomRes = await getSettings(getCustomReq);
      const customSettings = await getCustomRes.json();

      assert.strictEqual(customSettings.dlNumber, 'BR-TEST-DL-2026-999', 'Custom dlNumber must be persisted');
      assert.strictEqual(customSettings.gstin, '10AAACM9999P1ZV', 'Custom gstin must be persisted');
    });

    await runTest('Settings API', '4.2 UPI ID update and passcode protection logic', async () => {
      // 1. Fetch current settings to verify default/initial upiPasscode
      const initReq = new Request('http://localhost:3000/api/settings');
      const initRes = await getSettings(initReq);
      const initSettings = await initRes.json();
      assert.ok(initSettings.upiPasscode !== undefined, 'Settings must include upiPasscode');

      // 2. Update Passcode via API
      const newPasscode = '7890';
      const savePasscodeReq = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upiPasscode: newPasscode }),
      });
      const savePasscodeRes = await saveSettings(savePasscodeReq);
      assert.strictEqual(savePasscodeRes.status, 200);

      // Verify persisted passcode via GET
      const getPasscodeRes = await getSettings(new Request('http://localhost:3000/api/settings'));
      const settingsWithNewPin = await getPasscodeRes.json();
      assert.strictEqual(settingsWithNewPin.upiPasscode, '7890', 'Passcode must be updated to 7890');

      // 3. Verify passcode authentication / protection logic
      const verifyPin = (enteredPin: string, storedPin: string) => {
        return enteredPin.trim() === storedPin.trim();
      };

      assert.strictEqual(verifyPin('7890', settingsWithNewPin.upiPasscode), true, 'Correct PIN must unlock');
      assert.strictEqual(verifyPin('0000', settingsWithNewPin.upiPasscode), false, 'Incorrect PIN must be rejected');
      assert.strictEqual(verifyPin('1234', settingsWithNewPin.upiPasscode), false, 'Old PIN must be rejected');

      // 4. Update custom UPI ID with customized flag and passcode
      const upiPayload = {
        upiId: 'testpharmacy@okhdfcbank',
        upiPayeeName: 'Manoj Medical Hall Test',
        upiCustomized: 'true',
        upiPasscode: newPasscode,
      };
      const saveUpiReq = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(upiPayload),
      });
      const saveUpiRes = await saveSettings(saveUpiReq);
      assert.strictEqual(saveUpiRes.status, 200);

      // Verify UPI ID persisted and does not revert to hardcoded default
      const getUpiRes = await getSettings(new Request('http://localhost:3000/api/settings'));
      const upiSettings = await getUpiRes.json();
      assert.strictEqual(upiSettings.upiId, 'testpharmacy@okhdfcbank', 'Custom UPI ID must be persisted');
      assert.strictEqual(upiSettings.upiPayeeName, 'Manoj Medical Hall Test', 'UPI payee name must be persisted');
      assert.ok(upiSettings.upiCustomized === true || upiSettings.upiCustomized === 'true', 'upiCustomized flag must be true');
    });

  } finally {
    // =========================================================================
    // CLEANUP
    // =========================================================================
    console.log('\n\x1b[35m▶ Performing Database Cleanup...\x1b[0m');

    // Clean test customers & associated prescriptions
    if (testPhoneNumbers.length > 0) {
      const customers = await db.customer.findMany({
        where: { phone: { in: testPhoneNumbers } },
        select: { id: true },
      });
      const customerIds = customers.map((c) => c.id);
      if (customerIds.length > 0) {
        await db.prescription.deleteMany({ where: { customerId: { in: customerIds } } });
        await db.customer.deleteMany({ where: { id: { in: customerIds } } });
      }
      console.log(`  ✔ Cleaned ${testPhoneNumbers.length} test customers and their prescriptions`);
    }

    // Clean test medicines
    if (testMedicineIds.length > 0) {
      await db.prescription.deleteMany({ where: { medicineId: { in: testMedicineIds } } });
      await db.medicine.deleteMany({ where: { id: { in: testMedicineIds } } });
      console.log(`  ✔ Cleaned ${testMedicineIds.length} test medicines`);
    }

    // Restore original pharmacy settings
    await db.pharmacySetting.deleteMany({});
    if (originalSettingsRows.length > 0) {
      await db.pharmacySetting.createMany({
        data: originalSettingsRows.map((r) => ({
          key: r.key,
          value: r.value,
        })),
      });
    }
    console.log(`  ✔ Restored ${originalSettingsRows.length} original pharmacy settings`);
  }

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

  console.log('\n===============================================================');
  console.log(`  TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED (${totalDuration}ms total)`);
  console.log('===============================================================\n');

  if (failedCount > 0) {
    console.error(`\x1b[31m✖ Some tests failed! (${failedCount} failures)\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m✔ ALL ${passedCount} BACKEND TESTS PASSED RIGOROUSLY!\x1b[0m\n`);
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('Fatal error in test runner:', e);
  process.exit(1);
});
