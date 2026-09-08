import { isSyrupMedicine, calculateRefill } from '../src/lib/refill-engine';
import { addDays, startOfDay, differenceInDays } from 'date-fns';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 TESTING: Syrup Refill Show Next Day Logic');
  console.log('====================================================\n');

  // TEST SUITE 1: isSyrupMedicine detection
  console.log('--- Test Suite 1: isSyrupMedicine Detection ---');

  // True cases
  assert(isSyrupMedicine({ name: 'Grilinctus BM Syrup 100ml' }), 'Grilinctus BM Syrup detected');
  assert(isSyrupMedicine({ name: 'Asthalin Syp 100ml' }), 'Asthalin Syp detected');
  assert(isSyrupMedicine({ name: 'Avdec Drops 15ml' }), 'Avdec Drops detected');
  assert(isSyrupMedicine({ name: 'Gelusil MPS Suspension 200ml' }), 'Gelusil Suspension detected');
  assert(isSyrupMedicine({ name: 'Ascoril D 12-Plus Liquid' }), 'Ascoril Liquid/Solution detected');
  assert(isSyrupMedicine({ name: 'Candid Mouth Gel' }), 'Oral gel detected');
  assert(isSyrupMedicine({ name: 'Random Liquid Tonic', category: 'Syrup' }), 'Category Syrup detected');
  assert(isSyrupMedicine({ name: 'Generic Multivitamin', unitType: 'ml' }), 'Unit type ml detected');
  assert(isSyrupMedicine({ name: 'Generic Elixir', customPackaging: '1 Bottle (Syrup)' }), 'Custom packaging bottle syrup detected');

  // False cases (Tablets, Capsules, Infant Milk)
  assert(!isSyrupMedicine({ name: 'Acitrom 4mg Tab 1x30', packagingType: 'bottle' }), 'Acitrom 4mg Tab in bottle is NOT syrup');
  assert(!isSyrupMedicine({ name: 'Thyronorm 50mcg Tab 1x120', packagingType: 'bottle' }), 'Thyronorm Tab in bottle is NOT syrup');
  assert(!isSyrupMedicine({ name: 'Telma 40 Tablet', category: 'Blood Pressure' }), 'Telma 40 is NOT syrup');
  assert(!isSyrupMedicine({ name: 'Glycomet 500 SR', category: 'Diabetes' }), 'Glycomet 500 is NOT syrup');
  assert(!isSyrupMedicine({ name: 'Nan Pro 1', category: 'Infant Milk', packagingType: 'tin' }), 'Infant Milk is NOT syrup');

  // TEST SUITE 2: calculateRefill for Syrup
  console.log('\n--- Test Suite 2: calculateRefill for Syrup ---');

  const today = startOfDay(new Date());

  // Scenario A: Syrup purchased today -> Refill due tomorrow (next day!)
  const syrupPurchasedToday = calculateRefill({
    lastPurchaseDate: today,
    lastPurchaseQty: 100, // 100 ml
    dailyDosage: 10,      // 10 ml/day
    medicineName: 'Grilinctus Syrup 100ml',
    category: 'Syrup',
    unitType: 'ml',
  });

  const tomorrow = addDays(today, 1);
  assert(syrupPurchasedToday.isSyrup === true, 'Calculated result has isSyrup === true');
  assert(syrupPurchasedToday.daysOfSupply === 1, 'Syrup daysOfSupply === 1 (scheduled for next day)');
  assert(
    syrupPurchasedToday.nextRefillDate.getTime() === tomorrow.getTime(),
    `Refill date is tomorrow (${syrupPurchasedToday.nextRefillDate.toISOString()} === ${tomorrow.toISOString()})`
  );
  assert(syrupPurchasedToday.daysRemaining === 1, 'Syrup purchased today has daysRemaining === 1');
  assert(syrupPurchasedToday.urgency === 'urgent', 'Syrup due tomorrow is marked as urgent');

  // Scenario B: Syrup purchased yesterday -> Refill due today!
  const yesterday = addDays(today, -1);
  const syrupPurchasedYesterday = calculateRefill({
    lastPurchaseDate: yesterday,
    lastPurchaseQty: 100,
    dailyDosage: 10,
    medicineName: 'Asthalin Syp 100ml',
  });

  assert(
    syrupPurchasedYesterday.nextRefillDate.getTime() === today.getTime(),
    'Syrup purchased yesterday is due today'
  );
  assert(syrupPurchasedYesterday.daysRemaining === 0, 'Syrup due today has daysRemaining === 0');
  assert(syrupPurchasedYesterday.urgency === 'overdue', 'daysRemaining 0 is overdue/due today');

  // Scenario C: Non-syrup tablet (Telma 40, 30 tabs, 1/day)
  const tabletPurchasedToday = calculateRefill({
    lastPurchaseDate: today,
    lastPurchaseQty: 30,
    dailyDosage: 1,
    medicineName: 'Telma 40',
    category: 'Blood Pressure',
    bufferDays: 3,
  });

  assert(tabletPurchasedToday.isSyrup === false, 'Tablet has isSyrup === false');
  assert(tabletPurchasedToday.daysOfSupply === 30, 'Tablet has 30 days supply');
  assert(tabletPurchasedToday.daysRemaining === 30, 'Tablet has 30 days remaining');
  assert(
    tabletPurchasedToday.nextRefillDate.getTime() === addDays(today, 27).getTime(),
    'Tablet refill scheduled 3 days before runout (day 27)'
  );

  // TEST SUITE 3: Delivery Run-Sheet Tab Logic
  console.log('\n--- Test Suite 3: Delivery Sheet Tab Filtering Logic ---');

  // Emulate delivery sheet functions
  const checkIsSyrup = (r: any) =>
    r.isSyrup ||
    isSyrupMedicine({
      name: r.medicine?.name,
      category: r.medicine?.category,
      packagingType: r.medicine?.packagingType,
      unitType: r.unitType,
      customPackaging: r.customPackaging,
    });

  const isItemOverdue = (r: any) => {
    const isSyrup = checkIsSyrup(r);
    const days = r.refillCalc?.daysRemaining ?? 99;
    return isSyrup ? days < 0 : days <= 0;
  };

  const isItemToday = (r: any) => {
    const isSyrup = checkIsSyrup(r);
    const days = r.refillCalc?.daysRemaining ?? 99;
    return isSyrup ? days === 0 : (days > 0 && days <= 1);
  };

  const isItemTomorrow = (r: any) => {
    const isSyrup = checkIsSyrup(r);
    const days = r.refillCalc?.daysRemaining ?? 99;
    return isSyrup ? days === 1 : days === 2;
  };

  // Case A: Syrup purchased today (daysRemaining = 1). Must show in 'Tomorrow / Next Day' tab, NOT 'Today'
  const syrupTodayItem = {
    medicine: { name: 'Benadryl Cough Syrup 100ml' },
    refillCalc: syrupPurchasedToday,
  };
  assert(!isItemToday(syrupTodayItem), 'Syrup purchased today is NOT in Today tab');
  assert(isItemTomorrow(syrupTodayItem), 'Syrup purchased today IS in Tomorrow / Next Day tab');
  assert(!isItemOverdue(syrupTodayItem), 'Syrup purchased today is NOT in Overdue tab');

  // Case B: Syrup purchased yesterday (daysRemaining = 0). Must show in 'Today' tab
  const syrupYesterdayItem = {
    medicine: { name: 'Asthalin Syp 100ml' },
    refillCalc: syrupPurchasedYesterday,
  };
  assert(isItemToday(syrupYesterdayItem), 'Syrup purchased yesterday IS in Today tab');
  assert(!isItemTomorrow(syrupYesterdayItem), 'Syrup purchased yesterday is NOT in Tomorrow tab');

  // Case C: Tablet with 1 day remaining (Stock runs out tomorrow -> Must deliver Today)
  const tabletDueTomorrow = {
    medicine: { name: 'Telma 40' },
    refillCalc: { daysRemaining: 1, isSyrup: false },
  };
  assert(isItemToday(tabletDueTomorrow), 'Tablet running out tomorrow IS delivered Today');
  assert(!isItemTomorrow(tabletDueTomorrow), 'Tablet running out tomorrow is NOT in Tomorrow tab');

  // Case D: Tablet with 2 days remaining (Must deliver Tomorrow)
  const tabletDueDayAfter = {
    medicine: { name: 'Telma 40' },
    refillCalc: { daysRemaining: 2, isSyrup: false },
  };
  assert(isItemTomorrow(tabletDueDayAfter), 'Tablet with 2 days left IS in Tomorrow tab');

  console.log('\n🎉 ALL SYRUP REFILL VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
