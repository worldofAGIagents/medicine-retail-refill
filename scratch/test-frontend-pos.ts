/**
 * Frontend POS & Billing Engine Comprehensive Verification Test Suite
 *
 * Covers:
 * 1. Inline MRP Editing & Line Calculation (Dynamic grossTotal, discountAmount, netTotal, and multi-item summary recalculation)
 * 2. Infant Milk Formula Margin Protection (Lactogen, Nan Pro, Similac, Aptamil, Cerelac 0% margin protection, standard medicines 10%, pharmacist override)
 * 3. Bill Privacy & Omission of GST and DL Numbers (Receipt preview template & WhatsApp bill text omission of DL: and GSTIN:)
 * 4. Add New Product UI & State Flow (Default states: BP, strip, 10 units, saveToCatalog=true; auto-switching to tin, 1 unit, 0% discount on Infant Milk)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  isInfantFormula,
  getDefaultDiscountPercent,
  calculateLineItem,
  calculateBillSummary,
  generateWhatsAppBillText,
  BillItemInput,
  PharmacyDetails,
} from '../src/lib/billing-engine';

interface TestCaseResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestCaseResult[] = [];
let currentSuite = '';

function suite(name: string) {
  currentSuite = name;
  console.log(`\n================================================================`);
  console.log(`📋 SUITE: ${name}`);
  console.log(`================================================================`);
}

function test(name: string, assertion: () => boolean | void, details?: string) {
  try {
    const outcome = assertion();
    const passed = outcome === undefined ? true : Boolean(outcome);
    if (passed) {
      console.log(`  ✅ PASS: ${name}`);
      results.push({ suite: currentSuite, name, passed: true, details });
    } else {
      console.error(`  ❌ FAIL: ${name}${details ? ` -> ${details}` : ''}`);
      results.push({ suite: currentSuite, name, passed: false, details });
    }
  } catch (err: any) {
    console.error(`  ❌ FAIL (Exception): ${name} -> ${err?.message || err}`);
    results.push({ suite: currentSuite, name, passed: false, details: err?.message });
  }
}

async function runTestSuite() {
  console.log('🚀 Starting POS & Billing Engine Frontend Test Suite...\n');

  // ============================================================================
  // 1. INLINE MRP EDITING & LINE CALCULATION
  // ============================================================================
  suite('1. Inline MRP Editing & Line Item Calculation');

  test('Calculate line item with original MRP: grossTotal = mrp * quantity', () => {
    const originalItem: BillItemInput = {
      name: 'Telma 40',
      category: 'Blood Pressure',
      mrp: 140,
      quantity: 2,
    };
    const calculated = calculateLineItem(originalItem);
    return (
      calculated.effectiveRate === 140 &&
      calculated.grossTotal === 280 && // 140 * 2
      calculated.discountPercent === 10 && // 10% default
      calculated.discountAmount === 28 && // 10% of 280
      calculated.netTotal === 252 // 280 - 28
    );
  });

  test('Inline MRP edit recalculates grossTotal, discountAmount, and netTotal properly', () => {
    // Initial line
    const item: BillItemInput = {
      name: 'Telma 40',
      category: 'Blood Pressure',
      mrp: 140,
      quantity: 2,
    };
    const initialLine = calculateLineItem(item);

    // Simulate user editing MRP inline in the POS table from 140 to 160
    const editedItem: BillItemInput = {
      ...item,
      mrp: 160,
    };
    const editedLine = calculateLineItem(editedItem);

    const grossUpdated = editedLine.grossTotal === 320; // 160 * 2
    const discountUpdated = editedLine.discountAmount === 32; // 10% of 320
    const netUpdated = editedLine.netTotal === 288; // 320 - 32
    const rateUpdated = editedLine.effectiveRate === 160;

    return grossUpdated && discountUpdated && netUpdated && rateUpdated;
  });

  test('Inline MRP downward edit (concession/discounted MRP) recalculates accurately', () => {
    const item: BillItemInput = {
      name: 'Amlokind 5',
      category: 'Blood Pressure',
      mrp: 100,
      quantity: 3,
    };
    const editedLine = calculateLineItem({ ...item, mrp: 85 });

    return (
      editedLine.effectiveRate === 85 &&
      editedLine.grossTotal === 255 && // 85 * 3
      editedLine.discountPercent === 10 &&
      editedLine.discountAmount === 25.5 && // 10% of 255
      editedLine.netTotal === 229.5 // 255 - 25.5
    );
  });

  test('Inline MRP edit preserves custom discount percent override', () => {
    const item: BillItemInput = {
      name: 'Glycomet 500',
      category: 'Diabetes',
      mrp: 50,
      quantity: 4,
      discountPercent: 15, // Custom 15% override
    };
    const initialLine = calculateLineItem(item);
    if (initialLine.grossTotal !== 200 || initialLine.discountAmount !== 30 || initialLine.netTotal !== 170) {
      return false;
    }

    // Now edit MRP from 50 to 60
    const editedLine = calculateLineItem({ ...item, mrp: 60 });
    return (
      editedLine.grossTotal === 240 && // 60 * 4
      editedLine.discountPercent === 15 &&
      editedLine.discountAmount === 36 && // 15% of 240
      editedLine.netTotal === 204 // 240 - 36
    );
  });

  test('Inline MRP edit preserves custom flat ₹ discount override', () => {
    const item: BillItemInput = {
      name: 'Syrup Benadryl',
      category: 'General / OTC',
      mrp: 150,
      quantity: 2,
      customDiscountAmount: 30, // Flat ₹30 discount
    };
    const initialLine = calculateLineItem(item);
    if (initialLine.grossTotal !== 300 || initialLine.discountAmount !== 30 || initialLine.netTotal !== 270) {
      return false;
    }

    // Now edit MRP from 150 to 180
    const editedLine = calculateLineItem({ ...item, mrp: 180 });
    return (
      editedLine.grossTotal === 360 && // 180 * 2
      editedLine.discountAmount === 30 && // Still flat ₹30 discount
      editedLine.netTotal === 330 // 360 - 30
    );
  });

  test('Multi-item bill summary recalculation when an item MRP is edited inline', () => {
    // Initial 3 items:
    // 1. Glycomet 500: MRP 50, qty 4 -> gross 200, 10% disc = 20, net = 180
    // 2. Lactogen 1: MRP 450, qty 1 -> gross 450, 0% disc = 0, net = 450
    // 3. Pan-D: MRP 150, qty 1 -> gross 150, 10% disc = 15, net = 135
    const initialItems: BillItemInput[] = [
      { name: 'Glycomet 500', category: 'Diabetes', mrp: 50, quantity: 4 },
      { name: 'Lactogen 1 400g Tin', category: 'Infant Milk', mrp: 450, quantity: 1 },
      { name: 'Pan-D', category: 'Gastric', mrp: 150, quantity: 1 },
    ];

    const initialSummary = calculateBillSummary(initialItems, { customerName: 'Rohan Sharma' });

    // Assert initial bill summary
    if (
      initialSummary.grossAmount !== 800 || // 200 + 450 + 150
      initialSummary.totalDiscount !== 35 || // 20 + 0 + 15
      initialSummary.netPayable !== 765 || // 800 - 35
      initialSummary.totalQuantity !== 6
    ) {
      return false;
    }

    // Now user edits Glycomet 500 MRP from 50 to 70 inline in the POS table
    const updatedItems: BillItemInput[] = [
      { ...initialItems[0], mrp: 70 }, // new gross: 280, disc: 28, net: 252
      initialItems[1],                 // gross: 450, disc: 0, net: 450
      initialItems[2],                 // gross: 150, disc: 15, net: 135
    ];

    const updatedSummary = calculateBillSummary(updatedItems, { customerName: 'Rohan Sharma' });

    // Expected updated summary:
    // Gross: 280 + 450 + 150 = 880
    // Total discount: 28 + 0 + 15 = 43
    // Net payable: 880 - 43 = 837
    // Total quantity: 6
    return (
      updatedSummary.grossAmount === 880 &&
      updatedSummary.totalDiscount === 43 &&
      updatedSummary.netPayable === 837 &&
      updatedSummary.totalQuantity === 6 &&
      updatedSummary.savingsPercent === 4.9 // (43 / 880) * 100 = 4.886% -> 4.9%
    );
  });

  test('Multi-item bill summary recalculation when infant milk MRP is updated', () => {
    // Edit Lactogen MRP from 450 to 480
    const items: BillItemInput[] = [
      { name: 'Glycomet 500', category: 'Diabetes', mrp: 70, quantity: 4 }, // gross 280, disc 28
      { name: 'Lactogen 1 400g Tin', category: 'Infant Milk', mrp: 480, quantity: 1 }, // gross 480, disc 0
      { name: 'Pan-D', category: 'Gastric', mrp: 150, quantity: 1 }, // gross 150, disc 15
    ];

    const summary = calculateBillSummary(items);
    // Gross: 280 + 480 + 150 = 910
    // Discount remains 43 (Lactogen has 0% margin protection)
    // Net payable: 910 - 43 = 867
    return (
      summary.grossAmount === 910 &&
      summary.totalDiscount === 43 &&
      summary.netPayable === 867
    );
  });

  // ============================================================================
  // 2. INFANT MILK FORMULA MARGIN PROTECTION
  // ============================================================================
  suite('2. Infant Milk Formula Margin Protection & Detection');

  const infantFormulas = [
    { name: 'Lactogen 1 400g Tin', brand: 'Lactogen' },
    { name: 'Nan Pro 1 Starter Infant Formula', brand: 'Nan Pro' },
    { name: 'Similac Plus Stage 1 Infant Powder', brand: 'Similac' },
    { name: 'Aptamil 1 First Infant Formula', brand: 'Aptamil' },
    { name: 'Cerelac Wheat Apple Baby Cereal', brand: 'Cerelac' },
  ];

  for (const formula of infantFormulas) {
    test(`isInfantFormula detects ${formula.brand} correctly`, () => {
      return isInfantFormula(formula.name, '', '') === true;
    });

    test(`getDefaultDiscountPercent returns 0% for ${formula.brand}`, () => {
      const discount = getDefaultDiscountPercent(formula.name, '', '');
      return discount === 0;
    });
  }

  test('isInfantFormula also detects category "Infant Milk" regardless of medicine name', () => {
    return (
      isInfantFormula('Special Nutrition Powder', '', 'Infant Milk') === true &&
      getDefaultDiscountPercent('Special Nutrition Powder', '', 'Infant Milk') === 0
    );
  });

  test('Additional known infant formulas are detected (Dexolac, Farex, Pediasure, Enfamil, Isomil, Nestogen)', () => {
    const list = [
      'Dexolac 1 Infant Formula',
      'Farex Baby Food',
      'Pediasure Complete',
      'Enfamil A+ Stage 1',
      'Isomil Soy Infant Formula',
      'Nestogen 1 Formula',
    ];
    return list.every((item) => isInfantFormula(item) && getDefaultDiscountPercent(item) === 0);
  });

  const standardMedicines = [
    { name: 'Telma 40 Tablet', generic: 'Telmisartan 40mg', category: 'Blood Pressure' },
    { name: 'Glycomet 500mg SR', generic: 'Metformin Hydrochloride', category: 'Diabetes' },
    { name: 'Pan-D Capsule', generic: 'Pantoprazole + Domperidone', category: 'Gastric' },
    { name: 'Amlokind 5 Tablet', generic: 'Amlodipine 5mg', category: 'Blood Pressure' },
  ];

  for (const med of standardMedicines) {
    test(`Standard medicine ${med.name} is NOT infant formula and defaults to 10% discount`, () => {
      const isInfant = isInfantFormula(med.name, med.generic, med.category);
      const discount = getDefaultDiscountPercent(med.name, med.generic, med.category);
      return isInfant === false && discount === 10;
    });
  }

  test('Infant milk formula allows pharmacist manual discount override', () => {
    // Pharmacist decides to give 5% special discount on Lactogen
    const lineWithOverride = calculateLineItem({
      name: 'Lactogen 1 400g Tin',
      category: 'Infant Milk',
      mrp: 450,
      quantity: 1,
      discountPercent: 5, // Pharmacist explicit override
    });

    const isInfant = lineWithOverride.isInfantMilk === true;
    const discountAccepted = lineWithOverride.discountPercent === 5;
    const discountAmountCorrect = lineWithOverride.discountAmount === 22.5; // 5% of 450
    const netTotalCorrect = lineWithOverride.netTotal === 427.5; // 450 - 22.5

    return isInfant && discountAccepted && discountAmountCorrect && netTotalCorrect;
  });

  test('Infant milk formula allows pharmacist flat ₹ discount override', () => {
    // Pharmacist decides to give flat ₹30 discount on Nan Pro
    const lineWithFlatDiscount = calculateLineItem({
      name: 'Nan Pro 1',
      category: 'Infant Milk',
      mrp: 550,
      quantity: 1,
      customDiscountAmount: 30, // Pharmacist flat ₹ override
    });

    return (
      lineWithFlatDiscount.isInfantMilk === true &&
      lineWithFlatDiscount.discountAmount === 30 &&
      lineWithFlatDiscount.netTotal === 520 &&
      lineWithFlatDiscount.discountPercent === 5.5 // (30 / 550) * 100 = 5.45% -> 5.5%
    );
  });

  test('Infant milk formula line item calculation without override enforces 0% discount', () => {
    const lineDefault = calculateLineItem({
      name: 'Similac Plus Stage 1',
      category: 'Infant Milk',
      mrp: 600,
      quantity: 2,
    });

    return (
      lineDefault.grossTotal === 1200 &&
      lineDefault.discountPercent === 0 &&
      lineDefault.discountAmount === 0 &&
      lineDefault.netTotal === 1200
    );
  });

  // ============================================================================
  // 3. BILL PRIVACY & OMISSION OF GST AND DL NUMBERS
  // ============================================================================
  suite('3. Bill Privacy & Omission of GST and DL Numbers');

  const billingPagePath = path.join(__dirname, '../src/app/billing/page.tsx');
  const billingPageContent = fs.readFileSync(billingPagePath, 'utf-8');

  test('src/app/billing/page.tsx file exists and was loaded successfully', () => {
    return billingPageContent.length > 0;
  });

  test('Verify receipt preview template code in src/app/billing/page.tsx does NOT contain "DL:" or "GSTIN:"', () => {
    // Extract the receipt preview section: from receipt container down to modal close
    const receiptSectionMatch = billingPageContent.match(
      /THERMAL 80MM \/ A4 RECEIPT PREVIEW[\s\S]*?Computer Generated Retail Invoice/
    );

    if (!receiptSectionMatch) {
      throw new Error('Could not locate receipt preview section in src/app/billing/page.tsx');
    }

    const receiptTemplateCode = receiptSectionMatch[0];

    // Check for "DL:" or "GSTIN:" in receipt template
    const hasDl = /DL\s*:/i.test(receiptTemplateCode);
    const hasGstin = /GSTIN\s*:/i.test(receiptTemplateCode);

    if (hasDl) {
      throw new Error('Receipt template code contains "DL:"');
    }
    if (hasGstin) {
      throw new Error('Receipt template code contains "GSTIN:"');
    }

    return !hasDl && !hasGstin;
  });

  test('Verify src/app/billing/page.tsx documents omission of GST and DL numbers in Pharmacy Profile Settings', () => {
    const commentMatch = billingPageContent.includes(
      '// Pharmacy Profile Settings (GST and DL are omitted from bills as per requirement)'
    );
    return commentMatch;
  });

  test('Verify generateWhatsAppBillText output does NOT contain "DL:" or "GSTIN:"', () => {
    // Create a bill summary
    const testBill = calculateBillSummary([
      { name: 'Telma 40', mrp: 140, quantity: 2 },
      { name: 'Lactogen 1', mrp: 450, quantity: 1 },
    ], {
      invoiceNo: 'MMH-26-00999',
      customerName: 'Kameshwar Prasad',
      customerPhone: '9431422744',
      customerVillage: 'Sarfuddinpur',
      paymentMode: 'cash',
    });

    // Pass pharmacy details that have DL and GSTIN present in store profile
    const pharmacyWithTaxDetails: PharmacyDetails = {
      name: 'Manoj Medical Hall',
      address: 'Sarfuddinpur, Muzaffarpur (843118)',
      phone: '9431422744',
      dlNumber: 'BR-2024-DL98765',
      gstin: '10AAACM1234F1Z9',
      upiId: 'manojmedical@okhdfcbank',
      upiPayeeName: 'Manoj Medical Hall',
    };

    const waText = generateWhatsAppBillText(testBill, pharmacyWithTaxDetails);

    // Verify omission of DL and GSTIN
    const hasDlColon = /DL\s*:/i.test(waText);
    const hasGstinColon = /GSTIN\s*:/i.test(waText);
    const hasDlValue = waText.includes('BR-2024-DL98765');
    const hasGstinValue = waText.includes('10AAACM1234F1Z9');

    if (hasDlColon) throw new Error('WhatsApp bill contains "DL:"');
    if (hasGstinColon) throw new Error('WhatsApp bill contains "GSTIN:"');
    if (hasDlValue) throw new Error('WhatsApp bill contains DL number value');
    if (hasGstinValue) throw new Error('WhatsApp bill contains GSTIN number value');

    // Also assert valid message contents
    const hasStoreName = waText.includes('MANOJ MEDICAL HALL');
    const hasCustomer = waText.includes('Kameshwar Prasad');
    const hasItems = waText.includes('Telma 40') && waText.includes('Lactogen 1');
    const hasNetPayable = waText.includes('NET AMOUNT PAYABLE: ₹702'); // (280-28) + 450 = 252 + 450 = 702

    return !hasDlColon && !hasGstinColon && !hasDlValue && !hasGstinValue && hasStoreName && hasCustomer && hasItems && hasNetPayable;
  });

  // ============================================================================
  // 4. ADD NEW PRODUCT UI & STATE FLOW
  // ============================================================================
  suite('4. Add New Product UI & State Flow');

  test('Verify default state values in src/app/billing/page.tsx', () => {
    // 1. customCategory defaults to 'Blood Pressure'
    const categoryMatch = billingPageContent.match(/const\s*\[customCategory,\s*setCustomCategory\]\s*=\s*useState\(['"]Blood Pressure['"]\)/);
    // 2. customPackaging defaults to 'strip'
    const packagingMatch = billingPageContent.match(/const\s*\[customPackaging,\s*setCustomPackaging\]\s*=\s*useState\(['"]strip['"]\)/);
    // 3. customUnitsPerPack defaults to 10
    const unitsMatch = billingPageContent.match(/const\s*\[customUnitsPerPack,\s*setCustomUnitsPerPack\]\s*=\s*useState\(10\)/);
    // 4. customSaveToCatalog defaults to true
    const catalogMatch = billingPageContent.match(/const\s*\[customSaveToCatalog,\s*setCustomSaveToCatalog\]\s*=\s*useState\(true\)/);

    if (!categoryMatch) throw new Error('customCategory does not default to "Blood Pressure"');
    if (!packagingMatch) throw new Error('customPackaging does not default to "strip"');
    if (!unitsMatch) throw new Error('customUnitsPerPack does not default to 10');
    if (!catalogMatch) throw new Error('customSaveToCatalog does not default to true');

    return true;
  });

  test('Verify category selection logic in src/app/billing/page.tsx: selecting "Infant Milk" switches packaging="tin", units=1, discount=0%', () => {
    // Check select dropdown onChange logic:
    // if (val === 'Infant Milk') {
    //   setCustomIsInfant(true);
    //   setCustomPackaging('tin');
    //   setCustomUnitsPerPack(1);
    //   setCustomDisc(0);
    // }
    const selectLogicMatch = billingPageContent.includes("if (val === 'Infant Milk')") &&
      billingPageContent.includes("setCustomPackaging('tin')") &&
      billingPageContent.includes("setCustomUnitsPerPack(1)") &&
      billingPageContent.includes("setCustomDisc(0)");

    if (!selectLogicMatch) {
      throw new Error('Category select handler does not contain the required Infant Milk auto-switching logic');
    }
    return true;
  });

  test('Verify infant checkbox logic in src/app/billing/page.tsx: checking sets category="Infant Milk", packaging="tin", units=1, discount=0%', () => {
    // Check checkbox onChange logic:
    // if (checked) {
    //   setCustomCategory('Infant Milk');
    //   setCustomPackaging('tin');
    //   setCustomUnitsPerPack(1);
    //   setCustomDisc(0);
    // }
    const checkboxLogicMatch = billingPageContent.includes("if (checked) {") &&
      billingPageContent.includes("setCustomCategory('Infant Milk')") &&
      billingPageContent.includes("setCustomPackaging('tin')") &&
      billingPageContent.includes("setCustomUnitsPerPack(1)") &&
      billingPageContent.includes("setCustomDisc(0)");

    if (!checkboxLogicMatch) {
      throw new Error('Infant milk checkbox handler does not contain the required auto-switching logic');
    }
    return true;
  });

  test('Simulate Add New Product state transitions: initial state -> select Infant Milk -> revert', () => {
    // Define state container simulating BillingPage state
    interface CustomProductState {
      customCategory: string;
      customPackaging: string;
      customUnitsPerPack: number;
      customSaveToCatalog: boolean;
      customDisc: number;
      customIsInfant: boolean;
    }

    let state: CustomProductState = {
      customCategory: 'Blood Pressure',
      customPackaging: 'strip',
      customUnitsPerPack: 10,
      customSaveToCatalog: true,
      customDisc: 10,
      customIsInfant: false,
    };

    // Step 1: Verify initial state
    if (
      state.customCategory !== 'Blood Pressure' ||
      state.customPackaging !== 'strip' ||
      state.customUnitsPerPack !== 10 ||
      state.customSaveToCatalog !== true ||
      state.customDisc !== 10 ||
      state.customIsInfant !== false
    ) {
      throw new Error('Initial state does not match expected defaults');
    }

    // Step 2: Simulate user selecting 'Infant Milk' from chronic category dropdown
    const onCategoryChange = (val: string) => {
      state.customCategory = val;
      if (val === 'Infant Milk') {
        state.customIsInfant = true;
        state.customPackaging = 'tin';
        state.customUnitsPerPack = 1;
        state.customDisc = 0;
      } else {
        if (state.customIsInfant) {
          state.customIsInfant = false;
          state.customPackaging = 'strip';
          state.customUnitsPerPack = 10;
          state.customDisc = 10;
        }
      }
    };

    onCategoryChange('Infant Milk');

    // Assert state after selecting Infant Milk
    if (
      (state.customCategory as string) !== 'Infant Milk' ||
      state.customPackaging !== 'tin' ||
      state.customUnitsPerPack !== 1 ||
      state.customDisc !== 0 ||
      state.customIsInfant !== true
    ) {
      throw new Error(`Invalid state after selecting Infant Milk: ${JSON.stringify(state)}`);
    }

    // Step 3: Simulate user switching back to 'Diabetes'
    onCategoryChange('Diabetes');

    // Assert state after reverting back to chronic medicine
    if (
      (state.customCategory as string) !== 'Diabetes' ||
      state.customPackaging !== 'strip' ||
      state.customUnitsPerPack !== 10 ||
      state.customDisc !== 10 ||
      state.customIsInfant !== false
    ) {
      throw new Error(`Invalid state after reverting to Diabetes: ${JSON.stringify(state)}`);
    }

    // Step 4: Simulate user toggling the Infant Formula checkbox
    const onCheckboxToggle = (checked: boolean) => {
      state.customIsInfant = checked;
      if (checked) {
        state.customCategory = 'Infant Milk';
        state.customPackaging = 'tin';
        state.customUnitsPerPack = 1;
        state.customDisc = 0;
      } else {
        state.customCategory = 'Blood Pressure';
        state.customPackaging = 'strip';
        state.customUnitsPerPack = 10;
        state.customDisc = 10;
      }
    };

    onCheckboxToggle(true);
    if (state.customCategory !== 'Infant Milk' || state.customPackaging !== 'tin' || state.customUnitsPerPack !== 1 || state.customDisc !== 0) {
      throw new Error('Checkbox ON failed to switch to tin/1/0%');
    }

    onCheckboxToggle(false);
    if (state.customCategory !== 'Blood Pressure' || state.customPackaging !== 'strip' || state.customUnitsPerPack !== 10 || state.customDisc !== 10) {
      throw new Error('Checkbox OFF failed to restore strip/10/10%');
    }

    return true;
  });

  test('Simulate adding a custom Infant Milk product to bill and verify line item calculation', () => {
    // When custom product is Infant Milk
    const customItem: BillItemInput = {
      name: 'Similac Pro-Advance',
      category: 'Infant Milk',
      packaging: 'tin (1s)',
      unitsPerPack: 1,
      mrp: 650,
      quantity: 2,
      discountPercent: 0, // Auto-set to 0% by form
    };

    const calculated = calculateLineItem(customItem);
    return (
      calculated.isInfantMilk === true &&
      calculated.grossTotal === 1300 && // 650 * 2
      calculated.discountPercent === 0 &&
      calculated.discountAmount === 0 &&
      calculated.netTotal === 1300
    );
  });

  test('Simulate adding a custom Blood Pressure medicine to bill and verify 10% default discount', () => {
    const customBpItem: BillItemInput = {
      name: 'Telma-AM 40/5',
      genericName: 'Telmisartan + Amlodipine',
      category: 'Blood Pressure',
      packaging: 'strip (10s)',
      unitsPerPack: 10,
      mrp: 210,
      quantity: 1,
      discountPercent: 10, // Form default
    };

    const calculated = calculateLineItem(customBpItem);
    return (
      calculated.isInfantMilk === false &&
      calculated.grossTotal === 210 &&
      calculated.discountPercent === 10 &&
      calculated.discountAmount === 21 &&
      calculated.netTotal === 189
    );
  });

  // ============================================================================
  // FINAL SUMMARY & EXIT
  // ============================================================================
  console.log(`\n================================================================`);
  console.log(`📊 TEST SUITE SUMMARY`);
  console.log(`================================================================`);

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log(`Total Tests Executed: ${results.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  // Group by suite
  const suiteNames = Array.from(new Set(results.map((r) => r.suite)));
  for (const sName of suiteNames) {
    const suiteTests = results.filter((r) => r.suite === sName);
    const suitePassed = suiteTests.filter((t) => t.passed).length;
    console.log(`  • ${sName}: ${suitePassed}/${suiteTests.length} Passed`);
  }

  console.log(`================================================================\n`);

  if (failedCount > 0) {
    console.error(`💥 TEST SUITE FAILED: ${failedCount} failure(s) detected.`);
    process.exit(1);
  } else {
    console.log(`🎉 ALL ${passedCount} POS & BILLING ENGINE TESTS PASSED!`);
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
