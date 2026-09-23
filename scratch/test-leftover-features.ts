import assert from 'assert';
import { isSyrupMedicine, calculateRefill } from '../src/lib/refill-engine';
import {
  detectMedicineFormFactor,
  parsePackDetails,
  FORM_FACTORS,
} from '../src/lib/medicine-classifier';

async function runTests() {
  console.log('🧪 Starting Clinical Refill Engine & Form Factor Verification...\n');

  // Test 1: Insulin Detection & Math
  console.log('Testing 1: Insulin Detection & Math');
  const insulinVial = {
    name: 'HUMAN MIXTARD 30/70 100IU/ML 10ML VIAL',
    packagingType: 'vial',
    unitsPerPack: 1000,
  };
  const ffInsulin = detectMedicineFormFactor(insulinVial);
  assert.strictEqual(ffInsulin, 'insulin', 'Expected form factor to be insulin');

  const packInsulin = parsePackDetails({
    name: insulinVial.name,
    packagingType: insulinVial.packagingType,
    unitsPerPack: insulinVial.unitsPerPack,
  });
  assert.strictEqual(packInsulin.unitsPerPack, 1000, 'Expected 10ml vial to be 1000 IU');
  assert.strictEqual(packInsulin.unitLabel, 'IU/day', 'Expected IU/day label');

  // 1000 IU at 20 IU/day with 4 days buffer:
  // daysOfSupply = 1000 / 20 = 50 days
  // refill target = 50 - 4 = day 46
  const refillInsulin = calculateRefill({
    lastPurchaseDate: new Date('2026-09-01T00:00:00Z'),
    lastPurchaseQty: 1000,
    dailyDosage: 20,
    bufferDays: 4,
    medicineName: insulinVial.name,
    packagingType: 'vial',
    unitType: 'units',
  });
  assert.strictEqual(refillInsulin.daysOfSupply, 50, 'Expected 50 days of supply for 1000 IU @ 20 IU/day');
  assert.strictEqual(refillInsulin.formFactor, 'insulin', 'Expected formFactor insulin');
  console.log('  ✅ Insulin 1000 IU vial @ 20 IU/day: 50 days supply, next refill day 46 (Pass)');

  // Insulin Pen: 300 IU (3ml cartridge) at 15 IU/day:
  // daysOfSupply = 300 / 15 = 20 days
  const refillInsulinPen = calculateRefill({
    lastPurchaseDate: new Date('2026-09-01T00:00:00Z'),
    lastPurchaseQty: 300,
    dailyDosage: 15,
    bufferDays: 4,
    medicineName: 'LANTUS SOLOSTAR PEN 3ML (300 IU)',
    packagingType: 'pen',
    unitType: 'units',
  });
  assert.strictEqual(refillInsulinPen.daysOfSupply, 20, 'Expected 20 days supply for 300 IU @ 15 IU/day');
  console.log('  ✅ Insulin 300 IU pen @ 15 IU/day: 20 days supply (Pass)');

  // Test 2: Syrup Detection & Math
  console.log('\nTesting 2: Syrup Detection & Math');
  const syrupBottle = {
    name: 'GELUSIL MPS ORAL LIQUID 200ML',
    packagingType: 'bottle',
  };
  const ffSyrup = detectMedicineFormFactor(syrupBottle);
  assert.strictEqual(ffSyrup, 'syrup', 'Expected form factor to be syrup');

  const packSyrup = parsePackDetails({
    name: syrupBottle.name,
    packagingType: syrupBottle.packagingType,
  });
  assert.strictEqual(packSyrup.unitsPerPack, 200, 'Expected parsed bottle volume to be 200 ml');
  assert.strictEqual(packSyrup.unitLabel, 'ml/day', 'Expected ml/day label');

  // 200 ml bottle at 10 ml/day with 2 days buffer:
  // daysOfSupply = 200 / 10 = 20 days
  const refillSyrupVolume = calculateRefill({
    lastPurchaseDate: new Date('2026-09-01T00:00:00Z'),
    lastPurchaseQty: 200,
    dailyDosage: 10,
    bufferDays: 2,
    medicineName: syrupBottle.name,
    unitType: 'ml',
  });
  assert.strictEqual(refillSyrupVolume.daysOfSupply, 20, 'Expected 20 days supply for 200ml @ 10ml/day');
  console.log('  ✅ Syrup 200ml bottle @ 10 ml/day: 20 days supply (Pass)');

  // Single unquantified bottle check (backward compatibility with 1-day acute syrup check):
  const refillSyrupSingle = calculateRefill({
    lastPurchaseDate: new Date(),
    lastPurchaseQty: 1,
    dailyDosage: 1,
    bufferDays: 1,
    medicineName: 'GELUSIL SYRUP 200ML',
    packagingType: 'bottle',
  });
  assert.strictEqual(refillSyrupSingle.isSyrup, true, 'Expected isSyrup: true');
  assert.strictEqual(refillSyrupSingle.daysOfSupply, 1, 'Expected 1 day supply for single acute bottle check');
  assert.strictEqual(refillSyrupSingle.daysRemaining, 1, 'Expected 1 day remaining');
  console.log('  ✅ Single bottle unquantified syrup: 1-day acute check-in backward compatibility (Pass)');

  // Test 3: Inhaler Detection & Math
  console.log('\nTesting 3: Inhaler Detection & Math');
  const inhalerItem = {
    name: 'FORACORT 200 ROTACAPS / MDI INHALER',
    packagingType: 'device',
  };
  const ffInhaler = detectMedicineFormFactor(inhalerItem);
  assert.strictEqual(ffInhaler, 'inhaler', 'Expected form factor to be inhaler');

  const packInhaler = parsePackDetails({
    name: inhalerItem.name,
  });
  assert.strictEqual(packInhaler.unitsPerPack, 200, 'Expected 200 metered doses / puffs');

  const refillInhaler = calculateRefill({
    lastPurchaseDate: new Date('2026-09-01T00:00:00Z'),
    lastPurchaseQty: 200,
    dailyDosage: 2,
    bufferDays: 4,
    medicineName: inhalerItem.name,
  });
  assert.strictEqual(refillInhaler.daysOfSupply, 100, 'Expected 100 days supply for 200 puffs @ 2 puffs/day');
  console.log('  ✅ Inhaler 200 puffs @ 2 puffs/day: 100 days supply (Pass)');

  // Test 4: Infant Milk Formula Detection & Math
  console.log('\nTesting 4: Infant Milk Formula Detection & Math');
  const milkItem = {
    name: 'LACTOGEN 1 400G TIN INFANT FORMULA',
    category: 'Infant Milk',
  };
  const ffMilk = detectMedicineFormFactor(milkItem);
  assert.strictEqual(ffMilk, 'infant_milk', 'Expected form factor infant_milk');

  const refillMilk = calculateRefill({
    lastPurchaseDate: new Date('2026-09-01T00:00:00Z'),
    lastPurchaseQty: 400,
    dailyDosage: 40,
    bufferDays: 2,
    medicineName: milkItem.name,
    category: 'Infant Milk',
  });
  assert.strictEqual(refillMilk.daysOfSupply, 10, 'Expected 10 days supply for 400g @ 40g/day');
  console.log('  ✅ Infant Milk 400g @ 40g/day: 10 days supply (Pass)');

  // Test 5: Tablets default math
  console.log('\nTesting 5: Tablet Refill Math');
  const refillTab = calculateRefill({
    lastPurchaseDate: new Date('2026-09-01T00:00:00Z'),
    lastPurchaseQty: 30,
    dailyDosage: 1,
    bufferDays: 3,
    medicineName: 'TELMA 40MG TAB 1X15',
  });
  assert.strictEqual(refillTab.daysOfSupply, 30, 'Expected 30 days supply for 30 tabs @ 1 tab/day');
  console.log('  ✅ Tablet 30 tabs @ 1 tab/day: 30 days supply (Pass)');

  console.log('\n🎉 ALL CLINICAL DOSAGE & REFILL CALCULATIONS PASSED WITH 0 ERRORS!');
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
