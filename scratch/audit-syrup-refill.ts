/**
 * Clinical Refill Engine & Syrup Next-Day Auditor
 * Comprehensive Verification & Audit Test Suite
 *
 * Audit Scope:
 * 1. Syrup Refill Engine (`src/lib/refill-engine.ts`):
 *    - `isSyrupMedicine()` against extensive catalog items:
 *      * Liquid syrups, cough formulas, suspensions, drops, elixirs, tonics, pediatric drops, oral gels, solutions
 *      * Tablet/capsule bottles: 'ACITROM 4MG TAB 1X30', 'THYRONORM 50MCG TAB 1X120', 'SHELCAL 500 TAB' must NOT be classified as syrup even if packagingType is bottle
 *      * Edge cases: empty/null objects, mixed casing, numeric doses, unusual packaging strings, infant milk
 *    - `calculateRefill()`:
 *      * Syrups purchased today: nextRefillDate is tomorrow (Next Day), daysOfSupply=1, daysRemaining=1, urgency='urgent', isSyrup=true
 *      * Syrups purchased yesterday: nextRefillDate is today, daysRemaining=0, urgency='overdue', isSyrup=true
 *      * Chronic tablets (BP, Diabetes, Thyroid): standard days of supply calculation (e.g. 30 tabs / 1 dose = 30 days, refill at 27 days with 3-day buffer)
 * 2. Refills Center & Delivery Run-Sheet Logic:
 *    - Delivery run-sheet tab classification (`src/app/delivery-sheet/page.tsx`):
 *      * Syrup purchased today (daysRemaining = 1) -> must match 'Tomorrow / Next Day' tab, must NOT appear in 'Today' tab
 *      * Syrup purchased yesterday (daysRemaining = 0) -> must match 'Today' tab
 *      * Tablet with 1 day remaining -> must appear in 'Today' tab (stock runs out tomorrow)
 *      * Tablet with 2 days remaining -> must appear in 'Tomorrow / Next Day' tab
 *    - Refills page (`src/app/refills/page.tsx`):
 *      * Category filter for 'Syrup' correctly matches syrups
 *      * Urgency badge shows 'Next Day (Tomorrow)' for syrup with 1 day remaining
 * 3. API Endpoints:
 *    - Verify `/api/refills` returns `isSyrup: true` and nextRefillDate for syrup prescriptions
 *    - Verify `/api/prescriptions` passes medicine data to `calculateRefill`
 */

import { addDays, differenceInDays, startOfDay, format } from 'date-fns';
import { isSyrupMedicine, calculateRefill, RefillCalculation } from '../src/lib/refill-engine';
import { db } from '../src/lib/db';
import { GET as getRefillsRoute, POST as postRefillRoute } from '../src/app/api/refills/route';
import { GET as getPrescriptionsRoute, POST as postPrescriptionRoute } from '../src/app/api/prescriptions/route';

interface AuditResult {
  suite: string;
  testCase: string;
  passed: boolean;
  error?: string;
  details?: string;
  durationMs: number;
}

const auditLog: AuditResult[] = [];

function runAudit(suite: string, testCase: string, assertionFn: () => void | Promise<void>) {
  const start = Date.now();
  try {
    const res = assertionFn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          const durationMs = Date.now() - start;
          auditLog.push({ suite, testCase, passed: true, durationMs });
          console.log(`  \x1b[32m✔ PASS\x1b[0m [${durationMs}ms] ${testCase}`);
        })
        .catch((err) => {
          const durationMs = Date.now() - start;
          auditLog.push({ suite, testCase, passed: false, error: err?.message || String(err), durationMs });
          console.error(`  \x1b[31m✘ FAIL\x1b[0m [${durationMs}ms] ${testCase}`);
          console.error(`    \x1b[33mError: ${err?.message || err}\x1b[0m`);
        });
    } else {
      const durationMs = Date.now() - start;
      auditLog.push({ suite, testCase, passed: true, durationMs });
      console.log(`  \x1b[32m✔ PASS\x1b[0m [${durationMs}ms] ${testCase}`);
    }
  } catch (err: any) {
    const durationMs = Date.now() - start;
    auditLog.push({ suite, testCase, passed: false, error: err?.message || String(err), durationMs });
    console.error(`  \x1b[31m✘ FAIL\x1b[0m [${durationMs}ms] ${testCase}`);
    console.error(`    \x1b[33mError: ${err?.message || err}\x1b[0m`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} - Expected: [${expected}], Got: [${actual}]`);
  }
}

function assertTrue(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`${message} - Expected true, Got false`);
  }
}

function assertFalse(condition: boolean, message: string) {
  if (condition) {
    throw new Error(`${message} - Expected false, Got true`);
  }
}

async function main() {
  console.log('\n======================================================================');
  console.log('  🏥 CLINICAL REFILL ENGINE & SYRUP NEXT-DAY AUDIT SUITE');
  console.log('======================================================================\n');

  // ====================================================================
  // SUITE 1: isSyrupMedicine() Classification Engine
  // ====================================================================
  console.log('\n📋 SUITE 1: isSyrupMedicine() Exhaustive Catalog & Packaging Classification');

  // 1.1 Liquid Syrups & Cough Formulas
  runAudit('Suite 1: isSyrupMedicine', '1.1.1: Grilinctus BM Syrup 100ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Grilinctus BM Syrup 100ml' }), 'Grilinctus Syrup must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.1.2: Ascoril D Plus Cough Formula -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Ascoril D Plus Cough Formula' }), 'Cough formula must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.1.3: Benadryl Cough Formula 100ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Benadryl Cough Formula 100ml' }), 'Benadryl Cough Formula must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.1.4: Zedex Cough Formula -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Zedex Cough Formula' }), 'Zedex Cough Formula must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.1.5: Corex Cough Linctus 100ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Corex Cough Linctus 100ml' }), 'Linctus must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.1.6: Asthalin Syp 100ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Asthalin Syp 100ml' }), 'Syp keyword must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.1.7: Cremaffin Liquid 225ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Cremaffin Liquid 225ml' }), 'Liquid keyword must be detected');
  });

  // 1.2 Suspensions
  runAudit('Suite 1: isSyrupMedicine', '1.2.1: Gelusil MPS Antacid Suspension 200ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Gelusil MPS Antacid Suspension 200ml' }), 'Suspension must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.2.2: Combiflam Susp 60ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Combiflam Susp 60ml' }), 'Susp keyword must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.2.3: Augmentin Duo Oral Suspension -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Augmentin Duo Oral Suspension' }), 'Oral suspension must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.2.4: Paracetamol Paediatric Suspension -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Paracetamol Paediatric Suspension' }), 'Paediatric suspension must be detected');
  });

  // 1.3 Drops & Pediatric Drops
  runAudit('Suite 1: isSyrupMedicine', '1.3.1: Avdec Drops 15ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Avdec Drops 15ml' }), 'Drops keyword must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.3.2: Nasivion Adult Nasal Drops -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Nasivion Adult Nasal Drops' }), 'Nasal drops must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.3.3: Otrivin Saline Drop 10ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Otrivin Saline Drop 10ml' }), 'Singular Drop must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.3.4: Colicaid Pediatric Drops 15ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Colicaid Pediatric Drops 15ml' }), 'Pediatric Drops must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.3.5: T-98 Pediatric Drop 15ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'T-98 Pediatric Drop 15ml' }), 'Pediatric Drop singular must be detected');
  });

  // 1.4 Elixirs & Tonics
  runAudit('Suite 1: isSyrupMedicine', '1.4.1: Dexamethasone Elixir 100ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Dexamethasone Elixir 100ml' }), 'Elixir must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.4.2: Dexorange Iron Tonic 200ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Dexorange Iron Tonic 200ml' }), 'Tonic must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.4.3: Liv 52 Tonic -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Liv 52 Tonic' }), 'Tonic brand must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.4.4: Multivitamin Tonics 200ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Multivitamin Tonics 200ml' }), 'Plural tonics must be detected');
  });

  // 1.5 Oral Gels & Paints
  runAudit('Suite 1: isSyrupMedicine', '1.5.1: Mucopain Oral Gel 10g -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Mucopain Oral Gel 10g' }), 'Oral gel must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.5.2: Dologel Mouth Paint 10ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Dologel Mouth Paint 10ml' }), 'Mouth paint must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.5.3: Candid Mouth Paint 15ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Candid Mouth Paint 15ml' }), 'Mouth paint must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.5.4: Kenalog In Orabase Oral Gels -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Kenalog In Orabase Oral Gels' }), 'Plural oral gels must be detected');
  });

  // 1.6 Solutions
  runAudit('Suite 1: isSyrupMedicine', '1.6.1: Betadine Surgical Solution 100ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Betadine Surgical Solution 100ml' }), 'Solution must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.6.2: Oral Rehydration Solutions (Liquid) -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Oral Rehydration Solutions (Liquid)' }), 'Plural solutions must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.6.3: Hexidine Mouthwash Solution 150ml -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Hexidine Mouthwash Solution 150ml' }), 'Mouthwash solution must be detected');
  });

  // 1.7 Category, Unit, & Custom Packaging Fallbacks
  runAudit('Suite 1: isSyrupMedicine', '1.7.1: category = "Syrup" -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Generic Compound', category: 'Syrup' }), 'Category Syrup must match');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.7.2: category = "Drops" -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Generic Drops', category: 'Drops' }), 'Category Drops must match');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.7.3: category = "Suspension" -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Generic Antacid', category: 'Suspension' }), 'Category Suspension must match');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.7.4: unitType = "ml" -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Generic Vitamin', unitType: 'ml' }), 'Unit ml must match');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.7.5: customPackaging = "100ml Bottle" -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Generic Compound', customPackaging: '100ml Bottle' }), '100ml Bottle custom pack must match');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.7.6: customPackaging = "Glass Bottle (Syrup)" -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'Generic Compound', customPackaging: 'Glass Bottle (Syrup)' }), 'Glass Bottle (Syrup) must match');
  });

  // 1.8 Tablet / Capsule Bottles (CRITICAL: Must NOT be classified as syrup even if packagingType is bottle)
  runAudit('Suite 1: isSyrupMedicine', '1.8.1: ACITROM 4MG TAB 1X30 in Bottle -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'ACITROM 4MG TAB 1X30', packagingType: 'bottle' }),
      'ACITROM 4MG TAB 1X30 in bottle must NOT be classified as syrup'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.8.2: THYRONORM 50MCG TAB 1X120 in Bottle -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'THYRONORM 50MCG TAB 1X120', packagingType: 'bottle' }),
      'THYRONORM 50MCG TAB 1X120 in bottle must NOT be classified as syrup'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.8.3: SHELCAL 500 TAB in Bottle -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'SHELCAL 500 TAB', packagingType: 'bottle' }),
      'SHELCAL 500 TAB in bottle must NOT be classified as syrup'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.8.4: SHELCAL 500 TAB with unitType="bottle" -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'SHELCAL 500 TAB', packagingType: 'bottle', unitType: 'bottle' }),
      'SHELCAL 500 TAB with unitType=bottle must NOT be classified as syrup'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.8.5: ACITROM 4MG TAB 1X30 with customPackaging="HDPE Bottle (30 Tabs)" -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'ACITROM 4MG TAB 1X30', customPackaging: 'HDPE Bottle (30 Tabs)' }),
      'ACITROM with customPackaging HDPE Bottle (30 Tabs) must NOT be syrup'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.8.6: CALPOL 500 TABLET in Bottle -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'CALPOL 500 TABLET', packagingType: 'bottle' }),
      'CALPOL 500 TABLET in bottle must NOT be syrup'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.8.7: EVION 400 CAP in Bottle -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'EVION 400 CAP', packagingType: 'bottle' }),
      'EVION 400 CAP in bottle must NOT be syrup'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.8.8: BECOSULES CAPSULES in Bottle -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'BECOSULES CAPSULES', packagingType: 'bottle' }),
      'BECOSULES CAPSULES in bottle must NOT be syrup'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.8.9: TELMA 40 TABLETS in Bottle -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'TELMA 40 TABLETS', packagingType: 'bottle' }),
      'TELMA 40 TABLETS in bottle must NOT be syrup'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.8.10: GLYCOMET 500 SR TAB in Bottle -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'GLYCOMET 500 SR TAB', packagingType: 'bottle' }),
      'GLYCOMET 500 SR TAB in bottle must NOT be syrup'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.8.11: ASPIRIN 75MG TABLET with category="Tablet" in Bottle -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'ASPIRIN 75MG TABLET', category: 'Tablet', packagingType: 'bottle' }),
      'Tablet category in bottle must NOT be syrup'
    );
  });

  // 1.9 Edge Cases
  runAudit('Suite 1: isSyrupMedicine', '1.9.1: null medicine -> FALSE', () => {
    assertFalse(isSyrupMedicine(null), 'null medicine must be false');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.9.2: undefined medicine -> FALSE', () => {
    assertFalse(isSyrupMedicine(undefined), 'undefined medicine must be false');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.9.3: empty object {} -> FALSE', () => {
    assertFalse(isSyrupMedicine({}), 'empty object must be false');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.9.4: all null attributes -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({
        name: null,
        genericName: null,
        category: null,
        packagingType: null,
        unitType: null,
        customPackaging: null,
      }),
      'all null attributes must be false'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.9.5: mixed casing "gRiLiNcTuS bM sYrUp 100mL" -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'gRiLiNcTuS bM sYrUp 100mL' }), 'Mixed casing syrup must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.9.6: mixed casing "AcItRoM 4Mg TaB 1X30" in "BoTtLe" -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'AcItRoM 4Mg TaB 1X30', packagingType: 'BoTtLe' }),
      'Mixed casing tablet bottle must NOT be syrup'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.9.7: numeric dose "PARACETAMOL 250MG/5ML SYP" -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'PARACETAMOL 250MG/5ML SYP' }), 'Numeric dose syp must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.9.8: numeric dose "AZITHRAL 200MG/5ML SUSP" -> TRUE', () => {
    assertTrue(isSyrupMedicine({ name: 'AZITHRAL 200MG/5ML SUSP' }), 'Numeric dose susp must be detected');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.9.9: numeric dose "AMODEP AT 5/50MG TAB" -> FALSE', () => {
    assertFalse(isSyrupMedicine({ name: 'AMODEP AT 5/50MG TAB' }), 'Numeric dose tab must be false');
  });

  runAudit('Suite 1: isSyrupMedicine', '1.9.10: unusual packaging "PET Bottle 100ml" -> TRUE', () => {
    assertTrue(
      isSyrupMedicine({ name: 'Generic Med', customPackaging: 'PET Bottle 100ml' }),
      'PET Bottle 100ml must be detected'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.9.11: unusual packaging "Blister Pack 10x10" -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'Generic Med', customPackaging: 'Blister Pack 10x10' }),
      'Blister pack must be false'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.9.12: infant milk tin -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'Nestle Nan Pro 1', category: 'Infant Milk', packagingType: 'tin' }),
      'Infant milk tin must be false'
    );
  });

  runAudit('Suite 1: isSyrupMedicine', '1.9.13: infant milk formula bottle -> FALSE', () => {
    assertFalse(
      isSyrupMedicine({ name: 'Similac Advance Infant Milk Formula', category: 'Infant Milk', packagingType: 'bottle' }),
      'Infant milk formula even with bottle packaging must NOT be classified as syrup'
    );
  });

  // ====================================================================
  // SUITE 2: calculateRefill() Engine Calculations
  // ====================================================================
  console.log('\n📋 SUITE 2: calculateRefill() Next-Day vs Chronic Schedule Calculations');

  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const twoDaysAgo = addDays(today, -2);

  // 2.1 Syrups purchased today
  runAudit('Suite 2: calculateRefill', '2.1: Syrup purchased today -> nextRefillDate tomorrow, supply=1, daysRemaining=1, urgency="urgent", isSyrup=true', () => {
    const calc = calculateRefill({
      lastPurchaseDate: today,
      lastPurchaseQty: 100,
      dailyDosage: 10,
      medicineName: 'Grilinctus BM Syrup 100ml',
      category: 'Syrup',
      unitType: 'ml',
    });

    assertTrue(calc.isSyrup === true, 'isSyrup must be true');
    assertEqual(calc.daysOfSupply, 1, 'daysOfSupply must be 1 for syrup next-day scheduling');
    assertEqual(calc.daysRemaining, 1, 'daysRemaining must be 1 (due tomorrow)');
    assertEqual(calc.urgency, 'urgent', 'urgency must be urgent for 1 day remaining');
    assertEqual(
      calc.nextRefillDate.getTime(),
      tomorrow.getTime(),
      `nextRefillDate (${calc.nextRefillDate.toISOString()}) must equal tomorrow (${tomorrow.toISOString()})`
    );
  });

  // 2.2 Syrups purchased yesterday
  runAudit('Suite 2: calculateRefill', '2.2: Syrup purchased yesterday -> nextRefillDate today, daysRemaining=0, urgency="overdue", isSyrup=true', () => {
    const calc = calculateRefill({
      lastPurchaseDate: yesterday,
      lastPurchaseQty: 100,
      dailyDosage: 10,
      medicineName: 'Asthalin Syp 100ml',
    });

    assertTrue(calc.isSyrup === true, 'isSyrup must be true');
    assertEqual(calc.daysOfSupply, 1, 'daysOfSupply must be 1');
    assertEqual(calc.daysRemaining, 0, 'daysRemaining must be 0 (due today)');
    assertEqual(calc.urgency, 'overdue', 'urgency must be overdue for 0 days remaining');
    assertEqual(
      calc.nextRefillDate.getTime(),
      today.getTime(),
      `nextRefillDate (${calc.nextRefillDate.toISOString()}) must equal today (${today.toISOString()})`
    );
  });

  // 2.3 Syrups purchased 2 days ago
  runAudit('Suite 2: calculateRefill', '2.3: Syrup purchased 2 days ago -> nextRefillDate yesterday, daysRemaining=-1, urgency="overdue", isSyrup=true', () => {
    const calc = calculateRefill({
      lastPurchaseDate: twoDaysAgo,
      lastPurchaseQty: 100,
      dailyDosage: 10,
      medicineName: 'Gelusil MPS Suspension 200ml',
    });

    assertTrue(calc.isSyrup === true, 'isSyrup must be true');
    assertEqual(calc.daysRemaining, -1, 'daysRemaining must be -1');
    assertEqual(calc.urgency, 'overdue', 'urgency must be overdue');
    assertEqual(calc.nextRefillDate.getTime(), yesterday.getTime(), 'nextRefillDate must be yesterday');
  });

  // 2.4 Chronic tablets (BP, Diabetes, Thyroid) standard days of supply calculation
  runAudit('Suite 2: calculateRefill', '2.4.1: BP tablet (Telma 40, 30 tabs, 1/day, buffer 3) purchased today -> supply=30, refill at day 27, daysRemaining=30, urgency="future"', () => {
    const calc = calculateRefill({
      lastPurchaseDate: today,
      lastPurchaseQty: 30,
      dailyDosage: 1,
      bufferDays: 3,
      medicineName: 'Telma 40',
      category: 'Blood Pressure',
    });

    assertFalse(calc.isSyrup === true, 'Tablet isSyrup must be false');
    assertEqual(calc.daysOfSupply, 30, '30 tabs / 1 dose = 30 days supply');
    assertEqual(calc.daysRemaining, 30, 'daysRemaining must be 30');
    assertEqual(calc.urgency, 'future', 'urgency must be future for 30 days remaining');
    assertEqual(
      calc.nextRefillDate.getTime(),
      addDays(today, 27).getTime(),
      'Refill must be scheduled 3 days before runout (day 27)'
    );
  });

  runAudit('Suite 2: calculateRefill', '2.4.2: Diabetes tablet (Glycomet 500, 60 tabs, 2/day, buffer 3) purchased today -> supply=30, refill at day 27', () => {
    const calc = calculateRefill({
      lastPurchaseDate: today,
      lastPurchaseQty: 60,
      dailyDosage: 2,
      bufferDays: 3,
      medicineName: 'Glycomet 500 SR',
      category: 'Diabetes',
    });

    assertFalse(calc.isSyrup === true, 'Tablet isSyrup must be false');
    assertEqual(calc.daysOfSupply, 30, '60 tabs / 2 doses = 30 days supply');
    assertEqual(calc.daysRemaining, 30, 'daysRemaining must be 30');
    assertEqual(
      calc.nextRefillDate.getTime(),
      addDays(today, 27).getTime(),
      'Refill scheduled at day 27'
    );
  });

  runAudit('Suite 2: calculateRefill', '2.4.3: Thyroid bottle (Thyronorm 50mcg, 100 tabs, 1/day, buffer 3) in bottle -> supply=100, refill at day 97', () => {
    const calc = calculateRefill({
      lastPurchaseDate: today,
      lastPurchaseQty: 100,
      dailyDosage: 1,
      bufferDays: 3,
      medicineName: 'Thyronorm 50mcg Tab 1x100',
      category: 'Thyroid',
      packagingType: 'bottle',
    });

    assertFalse(calc.isSyrup === true, 'Thyronorm tablet bottle must NOT be syrup');
    assertEqual(calc.daysOfSupply, 100, '100 tabs / 1 dose = 100 days supply');
    assertEqual(calc.daysRemaining, 100, 'daysRemaining must be 100');
    assertEqual(
      calc.nextRefillDate.getTime(),
      addDays(today, 97).getTime(),
      'Refill scheduled at day 97 (100 - 3 buffer)'
    );
  });

  runAudit('Suite 2: calculateRefill', '2.4.4: Chronic tablet purchased 28 days ago (30 tabs, 1/day) -> daysRemaining=2, urgency="urgent"', () => {
    const calc = calculateRefill({
      lastPurchaseDate: addDays(today, -28),
      lastPurchaseQty: 30,
      dailyDosage: 1,
      bufferDays: 3,
      medicineName: 'Amlodipine 5mg',
      category: 'BP',
    });

    assertEqual(calc.daysRemaining, 2, 'daysRemaining must be 2');
    assertEqual(calc.urgency, 'urgent', 'daysRemaining <= 2 must be urgent');
  });

  runAudit('Suite 2: calculateRefill', '2.4.5: Chronic tablet purchased 30 days ago (30 tabs, 1/day) -> daysRemaining=0, urgency="overdue"', () => {
    const calc = calculateRefill({
      lastPurchaseDate: addDays(today, -30),
      lastPurchaseQty: 30,
      dailyDosage: 1,
      bufferDays: 3,
      medicineName: 'Atorvastatin 10mg',
      category: 'Cholesterol',
    });

    assertEqual(calc.daysRemaining, 0, 'daysRemaining must be 0');
    assertEqual(calc.urgency, 'overdue', 'daysRemaining <= 0 must be overdue');
  });

  // ====================================================================
  // SUITE 3: Refills Center & Delivery Run-Sheet Logic
  // ====================================================================
  console.log('\n📋 SUITE 3: Delivery Run-Sheet & Refills Page Tab / Badge Logic');

  // Exact replication of logic in `src/app/delivery-sheet/page.tsx`
  const checkIsSyrupDeliverySheet = (r: any) => {
    return (
      r.isSyrup ||
      isSyrupMedicine({
        name: r.medicine?.name,
        genericName: r.medicine?.genericName,
        category: r.medicine?.category,
        packagingType: r.medicine?.packagingType,
        unitType: r.unitType,
        customPackaging: r.customPackaging,
      })
    );
  };

  const isDeliveryOverdue = (r: any) => {
    const isSyrup = checkIsSyrupDeliverySheet(r);
    const days = r.refillCalc?.daysRemaining ?? 99;
    return isSyrup ? days < 0 : days <= 0;
  };

  const isDeliveryToday = (r: any) => {
    const isSyrup = checkIsSyrupDeliverySheet(r);
    const days = r.refillCalc?.daysRemaining ?? 99;
    return isSyrup ? days === 0 : days > 0 && days <= 1;
  };

  const isDeliveryTomorrow = (r: any) => {
    const isSyrup = checkIsSyrupDeliverySheet(r);
    const days = r.refillCalc?.daysRemaining ?? 99;
    return isSyrup ? days === 1 : days === 2;
  };

  const isDeliveryDayAfter = (r: any) => {
    const isSyrup = checkIsSyrupDeliverySheet(r);
    const days = r.refillCalc?.daysRemaining ?? 99;
    return isSyrup ? days === 2 : days === 3;
  };

  // 3.1.1: Syrup purchased today (daysRemaining = 1) -> must match 'Tomorrow / Next Day', NOT 'Today', NOT 'Overdue'
  runAudit('Suite 3: Delivery Sheet Logic', '3.1.1: Syrup purchased today (daysRemaining=1) -> matches Tomorrow tab, NOT Today, NOT Overdue', () => {
    const syrupToday = {
      medicine: { name: 'Grilinctus BM Syrup 100ml', category: 'Syrup' },
      isSyrup: true,
      refillCalc: { daysRemaining: 1, urgency: 'urgent', nextRefillDate: tomorrow.toISOString() },
    };

    assertTrue(isDeliveryTomorrow(syrupToday), 'Must appear in Tomorrow / Next Day tab');
    assertFalse(isDeliveryToday(syrupToday), 'Must NOT appear in Today tab');
    assertFalse(isDeliveryOverdue(syrupToday), 'Must NOT appear in Overdue tab');
  });

  // 3.1.2: Syrup purchased yesterday (daysRemaining = 0) -> must match 'Today' tab, NOT 'Tomorrow'
  runAudit('Suite 3: Delivery Sheet Logic', '3.1.2: Syrup purchased yesterday (daysRemaining=0) -> matches Today tab, NOT Tomorrow', () => {
    const syrupYesterday = {
      medicine: { name: 'Asthalin Syp 100ml', category: 'Syrup' },
      isSyrup: true,
      refillCalc: { daysRemaining: 0, urgency: 'overdue', nextRefillDate: today.toISOString() },
    };

    assertTrue(isDeliveryToday(syrupYesterday), 'Must appear in Today tab (next day has arrived)');
    assertFalse(isDeliveryTomorrow(syrupYesterday), 'Must NOT appear in Tomorrow tab');
    assertFalse(isDeliveryOverdue(syrupYesterday), 'Must NOT be considered overdue on delivery day');
  });

  // 3.1.3: Syrup purchased 2 days ago (daysRemaining = -1) -> must match 'Overdue' tab
  runAudit('Suite 3: Delivery Sheet Logic', '3.1.3: Syrup purchased 2 days ago (daysRemaining=-1) -> matches Overdue tab', () => {
    const syrupOverdue = {
      medicine: { name: 'Gelusil MPS Suspension 200ml', category: 'Syrup' },
      isSyrup: true,
      refillCalc: { daysRemaining: -1, urgency: 'overdue', nextRefillDate: yesterday.toISOString() },
    };

    assertTrue(isDeliveryOverdue(syrupOverdue), 'Must appear in Overdue tab');
    assertFalse(isDeliveryToday(syrupOverdue), 'Must NOT appear in Today tab');
    assertFalse(isDeliveryTomorrow(syrupOverdue), 'Must NOT appear in Tomorrow tab');
  });

  // 3.1.4: Tablet with 1 day remaining (stock runs out tomorrow) -> must appear in 'Today' tab
  runAudit('Suite 3: Delivery Sheet Logic', '3.1.4: Tablet with 1 day remaining (stock runs out tomorrow) -> matches Today tab, NOT Tomorrow tab', () => {
    const tabletDueTomorrow = {
      medicine: { name: 'Telma 40 Tab', category: 'BP' },
      isSyrup: false,
      refillCalc: { daysRemaining: 1, urgency: 'urgent', nextRefillDate: today.toISOString() },
    };

    assertTrue(isDeliveryToday(tabletDueTomorrow), 'Tablet running out tomorrow must be delivered Today');
    assertFalse(isDeliveryTomorrow(tabletDueTomorrow), 'Tablet running out tomorrow must NOT appear in Tomorrow tab');
  });

  // 3.1.5: Tablet with 2 days remaining -> must appear in 'Tomorrow / Next Day' tab
  runAudit('Suite 3: Delivery Sheet Logic', '3.1.5: Tablet with 2 days remaining -> matches Tomorrow / Next Day tab, NOT Today tab', () => {
    const tabletDue2Days = {
      medicine: { name: 'Glycomet 500 SR Tab', category: 'Diabetes' },
      isSyrup: false,
      refillCalc: { daysRemaining: 2, urgency: 'urgent', nextRefillDate: tomorrow.toISOString() },
    };

    assertTrue(isDeliveryTomorrow(tabletDue2Days), 'Tablet with 2 days remaining must appear in Tomorrow tab');
    assertFalse(isDeliveryToday(tabletDue2Days), 'Tablet with 2 days remaining must NOT appear in Today tab');
  });

  // 3.1.6: Tablet with 3 days remaining -> must appear in 'Day After / 3 Days' tab
  runAudit('Suite 3: Delivery Sheet Logic', '3.1.6: Tablet with 3 days remaining -> matches Day After / 3 Days tab', () => {
    const tabletDue3Days = {
      medicine: { name: 'Thyronorm 50mcg Tab 1x120', category: 'Thyroid', packagingType: 'bottle' },
      isSyrup: false,
      refillCalc: { daysRemaining: 3, urgency: 'due_soon', nextRefillDate: addDays(today, 1).toISOString() },
    };

    assertTrue(isDeliveryDayAfter(tabletDue3Days), 'Tablet with 3 days remaining must appear in Day After tab');
    assertFalse(isDeliveryToday(tabletDue3Days), 'Tablet with 3 days remaining must NOT appear in Today tab');
    assertFalse(isDeliveryTomorrow(tabletDue3Days), 'Tablet with 3 days remaining must NOT appear in Tomorrow tab');
  });

  // 3.2 Refills page (`src/app/refills/page.tsx`): Category filter & Urgency Badge logic
  const checkRefillCategoryFilter = (item: any, categoryFilter: string) => {
    if (categoryFilter === 'All') return true;
    const catQuery = categoryFilter.toLowerCase();
    if (catQuery === 'syrup') {
      return (
        item.isSyrup ||
        isSyrupMedicine({
          name: item.medicine?.name,
          genericName: item.medicine?.genericName,
          category: item.medicine?.category,
          packagingType: item.medicine?.packagingType,
          unitType: item.unitType,
          customPackaging: item.customPackaging,
        })
      );
    }
    const medCat = item.medicine?.category?.toLowerCase() || '';
    if (catQuery === 'bp') return medCat.includes('bp') || medCat.includes('blood pressure');
    return medCat.includes(catQuery);
  };

  const getRefillBadgeText = (item: any) => {
    const days = item.refillCalc?.daysRemaining ?? 0;
    const isSyrup =
      item.isSyrup ||
      isSyrupMedicine({
        name: item.medicine?.name,
        genericName: item.medicine?.genericName,
        category: item.medicine?.category,
        packagingType: item.medicine?.packagingType,
        unitType: item.unitType,
        customPackaging: item.customPackaging,
      });

    if (days <= 0) return `${Math.abs(days)} days overdue`;
    if (isSyrup && days === 1) return 'Next Day (Tomorrow)';
    return `${days} days left`;
  };

  runAudit('Suite 3: Refills Page Logic', '3.2.1: Category filter for "Syrup" matches all syrups and excludes tablet bottles', () => {
    const syrupItem = {
      isSyrup: true,
      medicine: { name: 'Grilinctus BM Syrup 100ml', category: 'Syrup' },
    };
    const tabletBottleItem = {
      isSyrup: false,
      medicine: { name: 'ACITROM 4MG TAB 1X30', category: 'Blood Pressure', packagingType: 'bottle' },
    };
    const thyroidBottleItem = {
      isSyrup: false,
      medicine: { name: 'THYRONORM 50MCG TAB 1X120', category: 'Thyroid', packagingType: 'bottle' },
    };
    const shelcalBottleItem = {
      isSyrup: false,
      medicine: { name: 'SHELCAL 500 TAB', category: 'Supplements', packagingType: 'bottle' },
    };

    assertTrue(checkRefillCategoryFilter(syrupItem, 'Syrup'), 'Syrup item must match Syrup filter');
    assertFalse(checkRefillCategoryFilter(tabletBottleItem, 'Syrup'), 'ACITROM bottle must NOT match Syrup filter');
    assertFalse(checkRefillCategoryFilter(thyroidBottleItem, 'Syrup'), 'THYRONORM bottle must NOT match Syrup filter');
    assertFalse(checkRefillCategoryFilter(shelcalBottleItem, 'Syrup'), 'SHELCAL bottle must NOT match Syrup filter');
  });

  runAudit('Suite 3: Refills Page Logic', '3.2.2: Urgency badge shows "Next Day (Tomorrow)" for syrup with 1 day remaining', () => {
    const syrup1Day = {
      isSyrup: true,
      medicine: { name: 'Benadryl Cough Formula 100ml', category: 'Syrup' },
      refillCalc: { daysRemaining: 1 },
    };
    assertEqual(getRefillBadgeText(syrup1Day), 'Next Day (Tomorrow)', 'Badge text must be Next Day (Tomorrow)');
  });

  runAudit('Suite 3: Refills Page Logic', '3.2.3: Urgency badge shows "1 days left" for tablet with 1 day remaining', () => {
    const tablet1Day = {
      isSyrup: false,
      medicine: { name: 'Telma 40 Tab', category: 'BP' },
      refillCalc: { daysRemaining: 1 },
    };
    assertEqual(getRefillBadgeText(tablet1Day), '1 days left', 'Tablet badge text must be 1 days left');
  });

  runAudit('Suite 3: Refills Page Logic', '3.2.4: Urgency badge shows overdue format for <= 0 days', () => {
    const overdueItem = {
      isSyrup: true,
      medicine: { name: 'Asthalin Syp 100ml', category: 'Syrup' },
      refillCalc: { daysRemaining: 0 },
    };
    assertEqual(getRefillBadgeText(overdueItem), '0 days overdue', 'Badge text must show 0 days overdue');

    const overdueItem2 = {
      isSyrup: false,
      medicine: { name: 'Glycomet 500 SR Tab', category: 'Diabetes' },
      refillCalc: { daysRemaining: -3 },
    };
    assertEqual(getRefillBadgeText(overdueItem2), '3 days overdue', 'Badge text must show 3 days overdue');
  });

  // ====================================================================
  // SUITE 4: API Endpoints Verification
  // ====================================================================
  console.log('\n📋 SUITE 4: API Endpoints Verification (/api/refills & /api/prescriptions)');

  // Create temporary test records in DB for API verification
  const testPhone = `999${Math.floor(1000000 + Math.random() * 9000000)}`;
  let testCustomer: any = null;
  let testSyrupMed: any = null;
  let testTabletMed: any = null;
  let testPrescriptionSyrup: any = null;
  let testPrescriptionTablet: any = null;

  try {
    testCustomer = await db.customer.create({
      data: {
        name: 'Audit Test Patient',
        phone: testPhone,
        locality: 'Sarfuddinpur',
        city: 'Muzaffarpur',
        address: 'Ward 4, Sarfuddinpur',
      },
    });

    testSyrupMed = await db.medicine.create({
      data: {
        name: 'Audit Grilinctus BM Syrup 100ml',
        genericName: 'Terbutaline + Bromhexine',
        category: 'Syrup',
        isChronicMed: true,
        mrp: 135,
        unitsPerPack: 1,
        packagingType: 'bottle',
        margItemCode: `TEST_SYP_${Date.now().toString().slice(-4)}`,
      },
    });

    testTabletMed = await db.medicine.create({
      data: {
        name: 'Audit ACITROM 4MG TAB 1X30',
        genericName: 'Nicoumalone',
        category: 'Blood Pressure',
        isChronicMed: true,
        mrp: 290,
        unitsPerPack: 30,
        packagingType: 'bottle',
        margItemCode: `TEST_TAB_${Date.now().toString().slice(-4)}`,
      },
    });

    // Create syrup prescription purchased today
    testPrescriptionSyrup = await db.prescription.create({
      data: {
        customerId: testCustomer.id,
        medicineId: testSyrupMed.id,
        dailyDosage: 10,
        dosageSchedule: 'Morning and Evening',
        lastPurchaseDate: today,
        lastPurchaseQty: 100,
        nextRefillDate: tomorrow,
        customPackaging: '1 Bottle (100ml)',
        unitType: 'ml',
        isActive: true,
      },
    });

    // Create tablet prescription purchased today
    testPrescriptionTablet = await db.prescription.create({
      data: {
        customerId: testCustomer.id,
        medicineId: testTabletMed.id,
        dailyDosage: 1,
        dosageSchedule: 'Morning',
        lastPurchaseDate: today,
        lastPurchaseQty: 30,
        nextRefillDate: addDays(today, 27),
        customPackaging: '1 Bottle (30 Tabs)',
        unitType: 'tablets',
        isActive: true,
      },
    });

    // 4.1 Verify GET /api/refills returns isSyrup: true and nextRefillDate for syrup
    await runAudit('Suite 4: API Endpoints', '4.1: GET /api/refills returns isSyrup: true and nextRefillDate for syrup', async () => {
      const req = new Request('http://localhost:3000/api/refills');
      const response = await getRefillsRoute(req);
      assertEqual(response.status, 200, 'GET /api/refills must return 200');
      const data = await response.json();
      assertTrue(Array.isArray(data), 'Response must be an array of refills');

      const syrupRefill = data.find((r: any) => r.id === testPrescriptionSyrup.id);
      assertTrue(!!syrupRefill, 'Created syrup prescription must be in /api/refills');
      assertEqual(syrupRefill.isSyrup, true, 'isSyrup must be true in /api/refills item');
      assertEqual(syrupRefill.refillCalc.isSyrup, true, 'refillCalc.isSyrup must be true');
      assertEqual(syrupRefill.refillCalc.daysOfSupply, 1, 'daysOfSupply must be 1 for syrup');
      assertEqual(syrupRefill.refillCalc.daysRemaining, 1, 'daysRemaining must be 1 for syrup purchased today');

      const tabletRefill = data.find((r: any) => r.id === testPrescriptionTablet.id);
      assertTrue(!!tabletRefill, 'Created tablet prescription must be in /api/refills');
      assertEqual(tabletRefill.isSyrup, false, 'ACITROM tablet bottle must have isSyrup: false in /api/refills');
      assertEqual(tabletRefill.refillCalc.isSyrup, false, 'refillCalc.isSyrup must be false for tablet bottle');
      assertEqual(tabletRefill.refillCalc.daysOfSupply, 30, 'daysOfSupply must be 30 for 30 tabs');
    });

    // 4.2 Verify POST /api/refills records refill and advances nextRefillDate for syrup
    await runAudit('Suite 4: API Endpoints', '4.2: POST /api/refills logs refill and calculates nextRefillDate to tomorrow for syrup', async () => {
      const postBody = {
        prescriptionId: testPrescriptionSyrup.id,
        quantity: 100,
        date: today.toISOString(),
      };
      const req = new Request('http://localhost:3000/api/refills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postBody),
      });

      const response = await postRefillRoute(req);
      assertEqual(response.status, 200, 'POST /api/refills must return 200');
      const updated = await response.json();

      const updatedRefillDate = startOfDay(new Date(updated.nextRefillDate));
      assertEqual(
        updatedRefillDate.getTime(),
        tomorrow.getTime(),
        'Refill record must advance nextRefillDate to tomorrow (Next Day) for syrup'
      );
    });

    // 4.3 Verify GET /api/prescriptions passes medicine data to calculateRefill
    await runAudit('Suite 4: API Endpoints', '4.3: GET /api/prescriptions passes medicine data to calculateRefill', async () => {
      const response = await getPrescriptionsRoute();
      assertEqual(response.status, 200, 'GET /api/prescriptions must return 200');
      const data = await response.json();
      assertTrue(Array.isArray(data), 'GET /api/prescriptions response must be an array');

      const syrupP = data.find((p: any) => p.id === testPrescriptionSyrup.id);
      assertTrue(!!syrupP, 'Syrup prescription must be present');
      assertTrue(!!syrupP.refillStatus, 'refillStatus must be populated by calculateRefill');
      assertEqual(syrupP.refillStatus.isSyrup, true, 'refillStatus.isSyrup must be true for syrup');
      assertEqual(syrupP.refillStatus.daysOfSupply, 1, 'refillStatus.daysOfSupply must be 1 for syrup');

      const tabletP = data.find((p: any) => p.id === testPrescriptionTablet.id);
      assertTrue(!!tabletP, 'Tablet prescription must be present');
      assertTrue(!!tabletP.refillStatus, 'refillStatus must be populated for tablet');
      assertEqual(tabletP.refillStatus.isSyrup, false, 'refillStatus.isSyrup must be false for ACITROM tablet bottle');
      assertEqual(tabletP.refillStatus.daysOfSupply, 30, 'refillStatus.daysOfSupply must be 30 for 30 tabs');
    });

    // 4.4 Verify POST /api/prescriptions calculates nextRefillDate automatically when omitted
    await runAudit('Suite 4: API Endpoints', '4.4: POST /api/prescriptions calculates nextRefillDate automatically for syrup', async () => {
      const newPrescriptionBody = {
        customerId: testCustomer.id,
        medicineId: testSyrupMed.id,
        dailyDosage: 10,
        dosageSchedule: 'Twice daily',
        lastPurchaseDate: today.toISOString(),
        lastPurchaseQty: 100,
        unitType: 'ml',
        customPackaging: '1 Bottle (100ml)',
        isActive: true,
      };

      const req = new Request('http://localhost:3000/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrescriptionBody),
      });

      const response = await postPrescriptionRoute(req);
      assertEqual(response.status, 201, 'POST /api/prescriptions must return 201');
      const created = await response.json();

      assertTrue(!!created.nextRefillDate, 'nextRefillDate must be automatically calculated and saved');
      const createdRefillDate = startOfDay(new Date(created.nextRefillDate));
      assertEqual(
        createdRefillDate.getTime(),
        tomorrow.getTime(),
        'Auto-calculated nextRefillDate must be tomorrow for syrup'
      );

      // Clean up extra prescription created
      await db.prescription.delete({ where: { id: created.id } });
    });
  } finally {
    // Cleanup temporary test records
    console.log('\n🧹 Cleaning up test database records...');
    try {
      if (testPrescriptionSyrup?.id) {
        await db.refillLog.deleteMany({ where: { prescriptionId: testPrescriptionSyrup.id } });
        await db.prescription.deleteMany({ where: { id: testPrescriptionSyrup.id } });
      }
      if (testPrescriptionTablet?.id) {
        await db.refillLog.deleteMany({ where: { prescriptionId: testPrescriptionTablet.id } });
        await db.prescription.deleteMany({ where: { id: testPrescriptionTablet.id } });
      }
      if (testSyrupMed?.id) {
        await db.medicine.deleteMany({ where: { id: testSyrupMed.id } });
      }
      if (testTabletMed?.id) {
        await db.medicine.deleteMany({ where: { id: testTabletMed.id } });
      }
      if (testCustomer?.id) {
        await db.customer.deleteMany({ where: { id: testCustomer.id } });
      }
      console.log('  \x1b[32m✔ DB Cleanup Complete\x1b[0m');
    } catch (cleanErr) {
      console.warn('  \x1b[33mCleanup notice:\x1b[0m', cleanErr);
    }
  }

  // ====================================================================
  // SUMMARY REPORT
  // ====================================================================
  console.log('\n======================================================================');
  console.log('  📊 CLINICAL REFILL ENGINE & SYRUP AUDIT REPORT SUMMARY');
  console.log('======================================================================');

  const total = auditLog.length;
  const passed = auditLog.filter((r) => r.passed).length;
  const failed = auditLog.filter((r) => !r.passed).length;

  console.log(`\n  Total Tests Executed: ${total}`);
  console.log(`  Tests Passed:         \x1b[32m${passed}\x1b[0m`);
  console.log(`  Tests Failed:         ${failed > 0 ? `\x1b[31m${failed}\x1b[0m` : `\x1b[32m0\x1b[0m`}`);

  const suites = Array.from(new Set(auditLog.map((r) => r.suite)));
  suites.forEach((s) => {
    const sTests = auditLog.filter((r) => r.suite === s);
    const sPassed = sTests.filter((r) => r.passed).length;
    console.log(`\n  Suite: ${s} (${sPassed}/${sTests.length} Passed)`);
  });

  if (failed > 0) {
    console.error('\n❌ FAILURES DETECTED:');
    auditLog
      .filter((r) => !r.passed)
      .forEach((f) => {
        console.error(`  - [${f.suite}] ${f.testCase}: ${f.error}`);
      });
    process.exit(1);
  } else {
    console.log('\n🎉 ALL CLINICAL REFILL ENGINE & SYRUP NEXT-DAY AUDIT TESTS PASSED SUCCESSFULLY!\n');
  }
}

main().catch((err) => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
