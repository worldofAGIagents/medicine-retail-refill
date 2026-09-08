/**
 * POS Billing Engine, Margin Protection & POS Checkout Exhaustive Audit Test Suite
 *
 * Audit Coverage:
 * 1. Direct Inline MRP Editing on the Bill (`src/app/billing/page.tsx`):
 *    - Immediate updates of gross total (MRP * Qty), discount amount, net payable
 *    - Upward and downward MRP adjustments
 *    - Preservation of custom discount % and flat ₹ discounts
 *    - Multi-item summary recalculation
 *    - Code-level verification of editable MRP input in cart table
 *
 * 2. Infant Milk Formula Margin Protection (`src/lib/billing-engine.ts`):
 *    - Detection of all 11 brands: Lactogen, Nan Pro, Similac, Aptamil, Dexolac, Farex, Cerelac, Pediasure, Enfamil, Isomil, Nestogen
 *    - Detection of category 'Infant Milk'
 *    - Strict 0% default discount for infant formulas
 *    - 10% default discount for standard medicines (Telma, Glycomet, Pan-D, etc.)
 *    - Pharmacist manual override for custom % or flat ₹ discounts
 *
 * 3. Add New Product / Item Flow:
 *    - Modal/form initial state: category='Blood Pressure', packaging='strip', units=10, saveToCatalog=true
 *    - Auto-switching on 'Infant Milk': packaging='tin', units=1, discount=0%
 *    - POST /api/medicines creates medicine with unique margItemCode, category 'Blood Pressure', and SQLite persistence
 *
 * 4. Bill Privacy & Omission of GST and DL Numbers:
 *    - Receipt print preview (thermal 80mm & A4) strictly omits GSTIN and DL numbers
 *    - generateWhatsAppBillText strictly omits 'DL:' and 'GSTIN:' or mock license numbers
 *    - UPI payment link generation with store UPI ID, bill amount, and invoice number
 *
 * 5. End-to-End POS Checkout:
 *    - POST /api/orders creates order and saves line items, gross amount, discount amount, and net amount
 *    - SQLite database validation of order, customer, order items, and billing metadata
 *    - GET /api/orders validation
 *    - Cleanup of test data
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  isInfantFormula,
  getDefaultDiscountPercent,
  calculateLineItem,
  calculateBillSummary,
  generateInvoiceNumber,
  generateWhatsAppBillText,
  BillItemInput,
  PharmacyDetails,
} from '../src/lib/billing-engine';
import { db } from '../src/lib/db';
import { POST as createMedicineRoute } from '../src/app/api/medicines/route';
import { POST as createOrderRoute, GET as getOrdersRoute } from '../src/app/api/orders/route';

interface TestRecord {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const auditRecords: TestRecord[] = [];
let currentSuiteName = '';

function suite(name: string) {
  currentSuiteName = name;
  console.log(`\n========================================================================`);
  console.log(`📋 AUDIT SUITE: ${name}`);
  console.log(`========================================================================`);
}

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    auditRecords.push({ suite: currentSuiteName, name: testName, passed: true, details });
  } else {
    console.error(`  ❌ FAIL: ${testName}${details ? ` -> ${details}` : ''}`);
    auditRecords.push({ suite: currentSuiteName, name: testName, passed: false, details });
  }
}

async function runAudit() {
  console.log('🩺 Initiating Exhaustive Retail Billing & POS Engine Audit...\n');

  // Track created entities for guaranteed cleanup
  const createdMedicineIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdCustomerIds: string[] = [];

  try {
    // ========================================================================
    // SUITE 1: Direct Inline MRP Editing on the Bill
    // ========================================================================
    suite('1. Direct Inline MRP Editing on the Bill (src/app/billing/page.tsx)');

    // 1.1 Baseline line item calculation
    const baselineItem: BillItemInput = {
      name: 'Telma 40 Strip',
      category: 'Blood Pressure',
      mrp: 140,
      quantity: 2,
    };
    const baselineLine = calculateLineItem(baselineItem);
    assert(
      baselineLine.grossTotal === 280 &&
      baselineLine.discountPercent === 10 &&
      baselineLine.discountAmount === 28 &&
      baselineLine.netTotal === 252,
      'Baseline item calculation: gross ₹280 (140 * 2), 10% disc ₹28, net ₹252'
    );

    // 1.2 Upward MRP adjustment
    const upwardEditedItem: BillItemInput = {
      ...baselineItem,
      mrp: 180, // Edited upward from 140 to 180
    };
    const upwardLine = calculateLineItem(upwardEditedItem);
    assert(
      upwardLine.effectiveRate === 180 &&
      upwardLine.grossTotal === 360 && // 180 * 2
      upwardLine.discountPercent === 10 &&
      upwardLine.discountAmount === 36 && // 10% of 360
      upwardLine.netTotal === 324, // 360 - 36
      'Upward MRP edit (140 -> 180) updates gross to ₹360, discount to ₹36, net to ₹324'
    );

    // 1.3 Downward MRP adjustment
    const downwardEditedItem: BillItemInput = {
      ...baselineItem,
      mrp: 100, // Edited downward from 140 to 100
    };
    const downwardLine = calculateLineItem(downwardEditedItem);
    assert(
      downwardLine.effectiveRate === 100 &&
      downwardLine.grossTotal === 200 && // 100 * 2
      downwardLine.discountPercent === 10 &&
      downwardLine.discountAmount === 20 && // 10% of 200
      downwardLine.netTotal === 180, // 200 - 20
      'Downward MRP edit (140 -> 100) updates gross to ₹200, discount to ₹20, net to ₹180'
    );

    // 1.4 Preserving custom discount % on MRP edit
    const customPercentItem: BillItemInput = {
      name: 'Glycomet 500',
      category: 'Diabetes',
      mrp: 50,
      quantity: 4,
      discountPercent: 15, // Custom 15% discount
    };
    const initialPercentLine = calculateLineItem(customPercentItem);
    assert(
      initialPercentLine.grossTotal === 200 &&
      initialPercentLine.discountAmount === 30 &&
      initialPercentLine.netTotal === 170,
      'Initial item with custom 15% discount: gross ₹200, disc ₹30, net ₹170'
    );

    const editedPercentItem: BillItemInput = {
      ...customPercentItem,
      mrp: 60, // Edited from 50 to 60
    };
    const editedPercentLine = calculateLineItem(editedPercentItem);
    assert(
      editedPercentLine.effectiveRate === 60 &&
      editedPercentLine.grossTotal === 240 && // 60 * 4
      editedPercentLine.discountPercent === 15 && // Preserved 15%
      editedPercentLine.discountAmount === 36 && // 15% of 240
      editedPercentLine.netTotal === 204, // 240 - 36
      'MRP edit (50 -> 60) preserves custom 15% discount: gross ₹240, disc ₹36, net ₹204'
    );

    // 1.5 Preserving flat ₹ discount on MRP edit
    const flatDiscountItem: BillItemInput = {
      name: 'Benadryl Cough Syrup',
      category: 'General / OTC',
      mrp: 150,
      quantity: 2,
      customDiscountAmount: 25, // Flat ₹25 off
    };
    const initialFlatLine = calculateLineItem(flatDiscountItem);
    assert(
      initialFlatLine.grossTotal === 300 &&
      initialFlatLine.discountAmount === 25 &&
      initialFlatLine.netTotal === 275,
      'Initial item with flat ₹25 discount: gross ₹300, disc ₹25, net ₹275'
    );

    const editedFlatItem: BillItemInput = {
      ...flatDiscountItem,
      mrp: 175, // Edited from 150 to 175
    };
    const editedFlatLine = calculateLineItem(editedFlatItem);
    assert(
      editedFlatLine.effectiveRate === 175 &&
      editedFlatLine.grossTotal === 350 && // 175 * 2
      editedFlatLine.discountAmount === 25 && // Preserved flat ₹25 discount
      editedFlatLine.netTotal === 325, // 350 - 25
      'MRP edit (150 -> 175) preserves flat ₹25 discount: gross ₹350, disc ₹25, net ₹325'
    );

    // 1.6 Multi-item bill summary recalculation on inline MRP edit
    const multiItemsInitial: BillItemInput[] = [
      { name: 'Telma 40', mrp: 140, quantity: 2 }, // gross 280, 10% disc = 28, net 252
      { name: 'Nan Pro 1', category: 'Infant Milk', mrp: 550, quantity: 1 }, // gross 550, 0% disc = 0, net 550
      { name: 'Pan-D', mrp: 160, quantity: 1 }, // gross 160, 10% disc = 16, net 144
    ];
    const initialBill = calculateBillSummary(multiItemsInitial);
    assert(
      initialBill.grossAmount === 990 && // 280 + 550 + 160
      initialBill.totalDiscount === 44 && // 28 + 0 + 16
      initialBill.netPayable === 946 && // 990 - 44
      initialBill.totalQuantity === 4,
      'Multi-item initial summary: gross ₹990, discount ₹44, net ₹946'
    );

    // Now edit Telma 40 MRP from 140 to 170 (gross becomes 340, disc becomes 34, net 306)
    const multiItemsEdited: BillItemInput[] = [
      { ...multiItemsInitial[0], mrp: 170 },
      multiItemsInitial[1],
      multiItemsInitial[2],
    ];
    const updatedBill = calculateBillSummary(multiItemsEdited);
    assert(
      updatedBill.grossAmount === 1050 && // 340 + 550 + 160
      updatedBill.totalDiscount === 50 && // 34 + 0 + 16
      updatedBill.netPayable === 1000 && // 1050 - 50
      updatedBill.totalQuantity === 4 &&
      updatedBill.savingsPercent === 4.8, // (50/1050)*100 = 4.76% -> 4.8%
      'Multi-item summary dynamically recalculates after inline MRP edit: gross ₹1050, discount ₹50, net ₹1000'
    );

    // 1.7 Verify code implementation of inline editable MRP input in src/app/billing/page.tsx
    const billingPageSrc = fs.readFileSync(path.join(__dirname, '../src/app/billing/page.tsx'), 'utf-8');
    const hasInlineMrpInput = billingPageSrc.includes('value={item.mrp}') &&
      billingPageSrc.includes('handleUpdateItem(idx, { mrp: isNaN(val) ? 0 : val })');
    const hasInlineMrpStyling = billingPageSrc.includes('title="Click to edit MRP directly"') ||
      billingPageSrc.includes('MRP ₹');
    assert(
      hasInlineMrpInput,
      'src/app/billing/page.tsx includes direct inline editable MRP <input> wired to handleUpdateItem'
    );
    assert(
      hasInlineMrpStyling,
      'src/app/billing/page.tsx visually styles editable MRP with distinct badge & title'
    );

    // ========================================================================
    // SUITE 2: Infant Milk Formula Margin Protection
    // ========================================================================
    suite('2. Infant Milk Formula Margin Protection (src/lib/billing-engine.ts)');

    // 2.1 Brand detection for all 11 required brands
    const brandsToTest = [
      { brand: 'Lactogen', sample: 'Lactogen 1 400g Tin' },
      { brand: 'Nan Pro', sample: 'Nan Pro 2 Infant Formula' },
      { brand: 'Similac', sample: 'Similac Plus Stage 1' },
      { brand: 'Aptamil', sample: 'Aptamil Stage 1 First Infant Milk' },
      { brand: 'Dexolac', sample: 'Dexolac 1 Infant Formula' },
      { brand: 'Farex', sample: 'Farex Gentle Baby Food' },
      { brand: 'Cerelac', sample: 'Cerelac Wheat Apple Cereal' },
      { brand: 'Pediasure', sample: 'Pediasure Complete Nutrition' },
      { brand: 'Enfamil', sample: 'Enfamil A+ Stage 1' },
      { brand: 'Isomil', sample: 'Isomil Soy Infant Powder' },
      { brand: 'Nestogen', sample: 'Nestogen 1 Baby Milk' },
    ];

    for (const item of brandsToTest) {
      const detected = isInfantFormula(item.sample, '', '');
      const defaultDisc = getDefaultDiscountPercent(item.sample, '', '');
      assert(
        detected === true,
        `Brand Detection: isInfantFormula correctly identifies "${item.brand}" in "${item.sample}"`
      );
      assert(
        defaultDisc === 0,
        `Margin Protection: getDefaultDiscountPercent strictly returns 0% for "${item.brand}"`
      );
    }

    // 2.2 Category 'Infant Milk' detection regardless of product name
    const categoryDetect = isInfantFormula('Special Nutrition Powder 400g', '', 'Infant Milk');
    const categoryDisc = getDefaultDiscountPercent('Special Nutrition Powder 400g', '', 'Infant Milk');
    assert(
      categoryDetect === true,
      'Category Detection: isInfantFormula detects category="Infant Milk" on generic product names'
    );
    assert(
      categoryDisc === 0,
      'Category Margin Protection: getDefaultDiscountPercent returns 0% for category="Infant Milk"'
    );

    // 2.3 Standard medicines default to 10% discount and NOT infant formula
    const standardMeds = [
      { name: 'Telma 40', generic: 'Telmisartan', cat: 'Blood Pressure' },
      { name: 'Glycomet 500', generic: 'Metformin', cat: 'Diabetes' },
      { name: 'Pan-D', generic: 'Pantoprazole + Domperidone', cat: 'Gastric' },
      { name: 'Thyronorm 50mcg', generic: 'Levothyroxine', cat: 'Thyroid' },
      { name: 'Amlokind 5', generic: 'Amlodipine', cat: 'Blood Pressure' },
    ];

    for (const med of standardMeds) {
      const isInfant = isInfantFormula(med.name, med.generic, med.cat);
      const defaultDisc = getDefaultDiscountPercent(med.name, med.generic, med.cat);
      assert(
        isInfant === false && defaultDisc === 10,
        `Standard Medicine: "${med.name}" is NOT infant formula and gets 10% default discount`
      );
    }

    // 2.4 Pharmacist manual override on Infant Milk (custom % discount)
    const infantWithPercentOverride = calculateLineItem({
      name: 'Lactogen 1 400g Tin',
      category: 'Infant Milk',
      mrp: 450,
      quantity: 2, // gross ₹900
      discountPercent: 5, // Pharmacist explicit 5% concession
    });
    assert(
      infantWithPercentOverride.isInfantMilk === true &&
      infantWithPercentOverride.discountPercent === 5 &&
      infantWithPercentOverride.discountAmount === 45 && // 5% of 900
      infantWithPercentOverride.netTotal === 855, // 900 - 45
      'Pharmacist manual override allows custom 5% discount on Lactogen (gross ₹900 -> disc ₹45, net ₹855)'
    );

    // 2.5 Pharmacist manual override on Infant Milk (flat ₹ discount)
    const infantWithFlatOverride = calculateLineItem({
      name: 'Nan Pro 1',
      category: 'Infant Milk',
      mrp: 600,
      quantity: 1, // gross ₹600
      customDiscountAmount: 40, // Pharmacist flat ₹40 concession
    });
    assert(
      infantWithFlatOverride.isInfantMilk === true &&
      infantWithFlatOverride.discountAmount === 40 &&
      infantWithFlatOverride.netTotal === 560 && // 600 - 40
      infantWithFlatOverride.discountPercent === 6.7, // (40/600)*100 = 6.66% -> 6.7%
      'Pharmacist manual override allows flat ₹40 discount on Nan Pro (gross ₹600 -> net ₹560)'
    );

    // 2.6 Strict 0% discount without manual override
    const infantDefaultLine = calculateLineItem({
      name: 'Similac Plus Stage 1',
      category: 'Infant Milk',
      mrp: 500,
      quantity: 3,
    });
    assert(
      infantDefaultLine.grossTotal === 1500 &&
      infantDefaultLine.discountPercent === 0 &&
      infantDefaultLine.discountAmount === 0 &&
      infantDefaultLine.netTotal === 1500,
      'Infant formula without manual override strictly preserves 0% discount and full MRP'
    );

    // ========================================================================
    // SUITE 3: Add New Product / Item Flow
    // ========================================================================
    suite('3. Add New Product / Item Flow (UI State & API Persistence)');

    // 3.1 Verify UI form initial state in src/app/billing/page.tsx
    const hasBpCategoryDefault = billingPageSrc.includes("useState('Blood Pressure')") ||
      billingPageSrc.includes('useState<string>(\'Blood Pressure\')');
    const hasPackagingDefault = billingPageSrc.includes("useState('strip')");
    const hasUnitsDefault = billingPageSrc.includes("useState(10)") || billingPageSrc.includes("useState<number>(10)");
    const hasSaveToCatalogDefault = billingPageSrc.includes("useState(true)");

    assert(hasBpCategoryDefault, 'Form State: Category defaults to "Blood Pressure"');
    assert(hasPackagingDefault, 'Form State: Packaging defaults to "strip"');
    assert(hasUnitsDefault, 'Form State: Units per pack defaults to 10');
    assert(hasSaveToCatalogDefault, 'Form State: Save permanently to catalog defaults to true');

    // 3.2 Verify category switching logic for Infant Milk
    const hasInfantCategorySwitchLogic =
      billingPageSrc.includes("if (val === 'Infant Milk')") &&
      billingPageSrc.includes("setCustomPackaging('tin')") &&
      billingPageSrc.includes("setCustomUnitsPerPack(1)") &&
      billingPageSrc.includes("setCustomDisc(0)");
    assert(
      hasInfantCategorySwitchLogic,
      'Form State: Selecting "Infant Milk" switches packaging to "tin", units to 1, discount to 0%'
    );

    // 3.3 Verify infant checkbox toggle logic
    const hasInfantCheckboxLogic =
      billingPageSrc.includes("if (checked) {") &&
      billingPageSrc.includes("setCustomCategory('Infant Milk')") &&
      billingPageSrc.includes("setCustomPackaging('tin')") &&
      billingPageSrc.includes("setCustomUnitsPerPack(1)") &&
      billingPageSrc.includes("setCustomDisc(0)");
    assert(
      hasInfantCheckboxLogic,
      'Form State: Checking Infant Milk checkbox switches category="Infant Milk", packaging="tin", units=1, disc=0%'
    );

    // 3.4 Verify POST /api/medicines creates medicine with auto-generated unique margItemCode & category 'Blood Pressure'
    const testMedPayload = {
      name: `Audit BP Medicine ${Date.now()}`,
      genericName: 'Audit Telmisartan 40mg',
      // category omitted -> should default to 'Blood Pressure'
      mrp: 135.5,
      unitsPerPack: 10,
      packagingType: 'strip',
      manufacturer: 'Audit Pharma Ltd',
    };

    const reqCreateMed = new Request('http://localhost:3005/api/medicines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testMedPayload),
    });

    const resCreateMed = await createMedicineRoute(reqCreateMed);
    assert(resCreateMed.status === 201, 'POST /api/medicines returns HTTP 201 Created');

    const createdMed = await resCreateMed.json();
    assert(Boolean(createdMed.id), `Created medicine has valid database ID (${createdMed.id})`);
    assert(createdMed.category === 'Blood Pressure', `Created medicine defaults to category "Blood Pressure" (got: "${createdMed.category}")`);
    assert(
      Boolean(createdMed.margItemCode) && createdMed.margItemCode.startsWith('MAN-'),
      `Created medicine has auto-generated margItemCode starting with "MAN-" (got: "${createdMed.margItemCode}")`
    );
    assert(createdMed.packagingType === 'strip', 'Created medicine packagingType is "strip"');
    assert(createdMed.unitsPerPack === 10, 'Created medicine unitsPerPack is 10');
    assert(createdMed.mrp === 135.5, 'Created medicine MRP is ₹135.50');

    if (createdMed.id) {
      createdMedicineIds.push(createdMed.id);
    }

    // 3.5 Verify persistence in SQLite via direct Prisma query
    const dbMed = await db.medicine.findUnique({
      where: { id: createdMed.id },
    });
    assert(
      dbMed !== null && dbMed.name === testMedPayload.name,
      'SQLite Persistence: Medicine record retrieved directly from SQLite database'
    );
    assert(
      dbMed?.margItemCode === createdMed.margItemCode,
      `SQLite Persistence: margItemCode "${dbMed?.margItemCode}" properly persisted in SQLite`
    );

    // 3.6 Verify creation of Infant Milk medicine with 'tin', 1 unit, and unique margItemCode
    const testInfantPayload = {
      name: `Audit Lacto Formula ${Date.now()}`,
      genericName: 'Audit Infant Formula',
      category: 'Infant Milk',
      mrp: 475,
      unitsPerPack: 1,
      packagingType: 'tin',
      manufacturer: 'Audit Nutrition',
    };

    const reqCreateInfant = new Request('http://localhost:3005/api/medicines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testInfantPayload),
    });

    const resCreateInfant = await createMedicineRoute(reqCreateInfant);
    const createdInfant = await resCreateInfant.json();
    assert(resCreateInfant.status === 201, 'POST /api/medicines creates Infant Milk product (HTTP 201)');
    assert(createdInfant.category === 'Infant Milk', 'Created product has category="Infant Milk"');
    assert(createdInfant.packagingType === 'tin', 'Created product packagingType is "tin"');
    assert(createdInfant.unitsPerPack === 1, 'Created product unitsPerPack is 1');
    assert(
      createdInfant.margItemCode !== createdMed.margItemCode,
      'Auto-generated margItemCode is uniquely generated across multiple product additions'
    );

    if (createdInfant.id) {
      createdMedicineIds.push(createdInfant.id);
    }

    // ========================================================================
    // SUITE 4: Bill Privacy & Omission of GST and DL Numbers
    // ========================================================================
    suite('4. Bill Privacy & Omission of GST and DL Numbers');

    // 4.1 Verify receipt print preview (thermal 80mm & A4) strictly omits GSTIN and DL numbers
    const receiptSectionMatch = billingPageSrc.match(
      /THERMAL 80MM \/ A4 RECEIPT PREVIEW[\s\S]*?Computer Generated Retail Invoice/
    );
    assert(Boolean(receiptSectionMatch), 'Located Thermal 80mm / A4 receipt preview block in src/app/billing/page.tsx');

    const receiptMarkup = receiptSectionMatch ? receiptSectionMatch[0] : '';
    const hasDlInReceipt = /DL\s*:/i.test(receiptMarkup);
    const hasGstInReceipt = /GSTIN\s*:/i.test(receiptMarkup) || /GST\s*:/i.test(receiptMarkup);
    assert(
      !hasDlInReceipt,
      'Receipt Print Preview: Strictly OMITS Drug License ("DL:")'
    );
    assert(
      !hasGstInReceipt,
      'Receipt Print Preview: Strictly OMITS GSTIN number ("GSTIN:")'
    );

    // 4.2 Verify Pharmacy Profile Settings in Billing Page
    assert(
      billingPageSrc.includes("dlNumber: ''") && billingPageSrc.includes("gstin: ''"),
      'Pharmacy state in billing page initializes dlNumber and gstin to blank strings'
    );

    // 4.3 Verify generateWhatsAppBillText strictly omits 'DL:' and 'GSTIN:' or mock license numbers
    const sampleBill = calculateBillSummary([
      { name: 'Telma 40', mrp: 140, quantity: 2 },
      { name: 'Lactogen 1', mrp: 450, quantity: 1 },
    ], {
      invoiceNo: 'MMH-26-88888',
      customerName: 'Shri Ramakant Ray',
      customerPhone: '9431422744',
      customerVillage: 'Sarfuddinpur',
      paymentMode: 'upi',
    });

    const pharmacyWithLicenses: PharmacyDetails = {
      name: 'Manoj Medical Hall',
      address: 'Sarfuddinpur, Muzaffarpur, Bihar (843118)',
      phone: '9431422744',
      dlNumber: 'BR-MUZ-2024-DL-9988',
      gstin: '10AAACM1234F1Z8',
      upiId: 'manojmedical@okhdfcbank',
      upiPayeeName: 'Manoj Medical Hall',
    };

    const waBillText = generateWhatsAppBillText(sampleBill, pharmacyWithLicenses);

    const waHasDlColon = /DL\s*:/i.test(waBillText);
    const waHasGstinColon = /GSTIN\s*:/i.test(waBillText);
    const waHasDlNumber = waBillText.includes('BR-MUZ-2024-DL-9988');
    const waHasGstinNumber = waBillText.includes('10AAACM1234F1Z8');

    assert(!waHasDlColon, 'WhatsApp Bill Text: Strictly OMITS "DL:" label');
    assert(!waHasGstinColon, 'WhatsApp Bill Text: Strictly OMITS "GSTIN:" label');
    assert(!waHasDlNumber, 'WhatsApp Bill Text: Strictly OMITS Drug License number value');
    assert(!waHasGstinNumber, 'WhatsApp Bill Text: Strictly OMITS GSTIN number value');

    // 4.4 Verify WhatsApp bill text contains necessary retail invoice elements
    assert(waBillText.includes('MANOJ MEDICAL HALL'), 'WhatsApp message contains pharmacy name header');
    assert(waBillText.includes('*Invoice No:* MMH-26-88888'), 'WhatsApp message contains invoice number');
    assert(waBillText.includes('Shri Ramakant Ray (Sarfuddinpur)'), 'WhatsApp message contains customer name & village');
    assert(waBillText.includes('Telma 40'), 'WhatsApp message contains item 1');
    assert(waBillText.includes('Lactogen 1'), 'WhatsApp message contains item 2');
    assert(waBillText.includes('NET AMOUNT PAYABLE: ₹702'), 'WhatsApp message contains net payable ₹702');
    assert(waBillText.includes('Payment Mode: *UPI*'), 'WhatsApp message contains payment mode');
    assert(waBillText.includes('swasth rahen') || waBillText.includes('स्वस्थ रहें'), 'WhatsApp message contains polite Hindi sign-off');

    // 4.5 Verify UPI payment link generation with store UPI ID and bill amount
    const upiLinkRegex = /upi:\/\/pay\?pa=([^&\s]+)&pn=([^&\s]+)&am=([^&\s]+)&cu=INR&tn=([^&\s]+)/;
    const upiMatch = waBillText.match(upiLinkRegex);
    assert(Boolean(upiMatch), 'WhatsApp text includes valid UPI payment deep link schema');

    if (upiMatch) {
      const decodedPa = decodeURIComponent(upiMatch[1]);
      const decodedPn = decodeURIComponent(upiMatch[2]);
      const billAmount = upiMatch[3];
      const decodedTn = decodeURIComponent(upiMatch[4]);

      assert(decodedPa === 'manojmedical@okhdfcbank', `UPI link "pa" matches store UPI ID (${decodedPa})`);
      assert(decodedPn === 'Manoj Medical Hall', `UPI link "pn" matches store payee name (${decodedPn})`);
      assert(billAmount === '702', `UPI link "am" matches bill net payable amount (${billAmount})`);
      assert(decodedTn.includes('MMH-26-88888'), `UPI link transaction note "tn" contains invoice number (${decodedTn})`);
    }

    // ========================================================================
    // SUITE 5: End-to-End POS Checkout
    // ========================================================================
    suite('5. End-to-End POS Checkout (POST /api/orders & SQLite Persistence)');

    // 5.1 Create a test customer to link the checkout order
    const testCustomerPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const testCustomer = await db.customer.create({
      data: {
        name: 'Suresh Pandey',
        phone: testCustomerPhone,
        address: 'गाँव: Sarfuddinpur',
        locality: 'Sarfuddinpur',
        city: 'Muzaffarpur',
        primaryCondition: 'Blood Pressure',
      },
    });
    createdCustomerIds.push(testCustomer.id);
    assert(Boolean(testCustomer.id), `Created test customer with ID: ${testCustomer.id} (Phone: ${testCustomerPhone})`);

    // 5.2 Build multi-item bill cart matching retail POS scenario
    // Item A: Standard medicine (Telma 40): MRP 140, Qty 2 -> gross 280, 10% disc 28, net 252
    // Item B: Infant Milk (Lactogen 1): MRP 450, Qty 1 -> gross 450, 0% disc 0, net 450
    // Item C: Chronic medicine with manual override (Glycomet 500): MRP 60, Qty 3 -> gross 180, flat ₹15 disc, net 165
    const checkoutCart: BillItemInput[] = [
      { medicineId: createdMed.id, name: 'Telma 40', mrp: 140, quantity: 2 },
      { medicineId: createdInfant.id, name: 'Lactogen 1 400g Tin', category: 'Infant Milk', mrp: 450, quantity: 1 },
      { name: 'Glycomet 500', mrp: 60, quantity: 3, customDiscountAmount: 15 },
    ];

    const checkoutSummary = calculateBillSummary(checkoutCart, {
      customerName: testCustomer.name,
      customerPhone: testCustomer.phone,
      customerVillage: 'Sarfuddinpur',
      doctorName: 'Dr. R.K. Sharma',
      paymentMode: 'cash',
    });

    assert(
      checkoutSummary.grossAmount === 910, // 280 + 450 + 180
      `Checkout Summary: Gross total is ₹910 (got: ${checkoutSummary.grossAmount})`
    );
    assert(
      checkoutSummary.totalDiscount === 43, // 28 + 0 + 15
      `Checkout Summary: Total discount is ₹43 (got: ${checkoutSummary.totalDiscount})`
    );
    assert(
      checkoutSummary.netPayable === 867, // 910 - 43
      `Checkout Summary: Net payable is ₹867 (got: ${checkoutSummary.netPayable})`
    );
    assert(
      checkoutSummary.totalQuantity === 6, // 2 + 1 + 3
      `Checkout Summary: Total units is 6 (got: ${checkoutSummary.totalQuantity})`
    );

    // 5.3 Submit Order via POST /api/orders
    const orderPayload = {
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      customerPhone: testCustomer.phone,
      customerVillage: 'Sarfuddinpur',
      doctorName: 'Dr. R.K. Sharma',
      invoiceNo: checkoutSummary.invoiceNo,
      orderType: 'retail',
      paymentMode: 'cash',
      paymentStatus: 'collected',
      totalAmount: checkoutSummary.netPayable, // 867
      grossAmount: checkoutSummary.grossAmount, // 910
      totalDiscount: checkoutSummary.totalDiscount, // 43
      roundOff: checkoutSummary.roundOff,
      items: checkoutSummary.items.map((itm) => ({
        medicineId: itm.medicineId,
        medicineName: itm.name,
        quantity: itm.quantity,
        unitPrice: itm.effectiveRate,
        totalPrice: itm.netTotal,
        mrp: itm.effectiveRate,
        discountPercent: itm.discountPercent,
        discountAmount: itm.discountAmount,
      })),
      billingSnapshot: checkoutSummary,
    };

    const reqCreateOrder = new Request('http://localhost:3005/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });

    const resCreateOrder = await createOrderRoute(reqCreateOrder);
    assert(resCreateOrder.status === 201, 'POST /api/orders returns HTTP 201 Created');

    const orderResult = await resCreateOrder.json();
    assert(orderResult.success === true, 'Order API response indicates success: true');
    assert(Boolean(orderResult.order?.id), `Order created with DB ID: ${orderResult.order?.id}`);
    assert(orderResult.order.totalAmount === 867, `Order net totalAmount is ₹867 (got: ${orderResult.order.totalAmount})`);
    assert(orderResult.order.grossAmount === 910, `Order grossAmount is ₹910 (got: ${orderResult.order.grossAmount})`);
    assert(orderResult.order.totalDiscount === 43, `Order totalDiscount is ₹43 (got: ${orderResult.order.totalDiscount})`);
    assert(orderResult.order.invoiceNo === checkoutSummary.invoiceNo, `Order invoiceNo matches (${orderResult.order.invoiceNo})`);

    const orderId = orderResult.order?.id;
    if (orderId) {
      createdOrderIds.push(orderId);
    }

    // 5.4 Query SQLite database directly to verify complete persistence
    const savedOrder = await db.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: true,
      },
    });

    assert(savedOrder !== null, 'Order record exists in SQLite order table');
    assert(savedOrder?.customerId === testCustomer.id, 'Order is linked to correct customer');
    assert(savedOrder?.status === 'delivered', 'Order status is "delivered" for retail POS checkout');
    assert(savedOrder?.paymentMode === 'cash', 'Order paymentMode is "cash"');
    assert(savedOrder?.paymentStatus === 'collected', 'Order paymentStatus is "collected"');
    assert(savedOrder?.amountCollected === 867, 'Order amountCollected is ₹867');
    assert(savedOrder?.totalAmount === 867, 'Order totalAmount persisted as ₹867 in SQLite');
    assert(savedOrder?.items.length === 3, 'Order items count is 3 in SQLite OrderItem table');

    // 5.5 Verify Order Line Items in SQLite
    const savedItem1 = savedOrder?.items.find((i) => i.medicineName === 'Telma 40');
    assert(
      savedItem1 !== undefined && savedItem1.quantity === 2 && savedItem1.totalPrice === 252,
      'Item 1 (Telma 40) persisted: Qty 2, Total Price ₹252'
    );

    const savedItem2 = savedOrder?.items.find((i) => i.medicineName.includes('Lactogen'));
    assert(
      savedItem2 !== undefined && savedItem2.quantity === 1 && savedItem2.totalPrice === 450,
      'Item 2 (Lactogen 1) persisted: Qty 1, Total Price ₹450'
    );

    const savedItem3 = savedOrder?.items.find((i) => i.medicineName === 'Glycomet 500');
    assert(
      savedItem3 !== undefined && savedItem3.quantity === 3 && savedItem3.totalPrice === 165,
      'Item 3 (Glycomet 500) persisted: Qty 3, Total Price ₹165'
    );

    // 5.6 Verify Order Notes metadata in SQLite
    const notesJson = savedOrder?.notes ? JSON.parse(savedOrder.notes) : null;
    assert(
      notesJson !== null &&
      notesJson.grossAmount === 910 &&
      notesJson.totalDiscount === 43 &&
      notesJson.doctorName === 'Dr. R.K. Sharma' &&
      notesJson.invoiceNo === checkoutSummary.invoiceNo,
      'Order notes field contains valid metadata JSON with grossAmount, totalDiscount, doctorName, and invoiceNo'
    );

    // 5.7 Verify GET /api/orders returns the formatted retail order
    const reqGetOrders = new Request('http://localhost:3005/api/orders?limit=10');
    const resGetOrders = await getOrdersRoute(reqGetOrders);
    const ordersList = await resGetOrders.json();
    const fetchedOrder = ordersList.find((o: any) => o.id === orderId);

    assert(fetchedOrder !== undefined, 'GET /api/orders successfully retrieves the created retail POS order');
    assert(fetchedOrder?.grossAmount === 910, `GET /api/orders parses grossAmount as ₹910`);
    assert(fetchedOrder?.totalDiscount === 43, `GET /api/orders parses totalDiscount as ₹43`);
    assert(fetchedOrder?.invoiceNo === checkoutSummary.invoiceNo, `GET /api/orders parses invoiceNo correctly`);

  } catch (err: any) {
    console.error('💥 Unexpected exception during audit execution:', err);
    assert(false, 'Execution exception', err?.message || String(err));
  } finally {
    // ========================================================================
    // CLEANUP
    // ========================================================================
    console.log('\n--- 🧹 Cleaning up Test Artifacts from SQLite Database ---');
    for (const ordId of createdOrderIds) {
      try {
        await db.orderItem.deleteMany({ where: { orderId: ordId } });
        await db.order.delete({ where: { id: ordId } });
        console.log(`  ✓ Removed test order: ${ordId}`);
      } catch (cleanupErr) {
        console.warn(`  ! Warning cleaning order ${ordId}:`, cleanupErr);
      }
    }

    for (const custId of createdCustomerIds) {
      try {
        await db.customer.delete({ where: { id: custId } });
        console.log(`  ✓ Removed test customer: ${custId}`);
      } catch (cleanupErr) {
        console.warn(`  ! Warning cleaning customer ${custId}:`, cleanupErr);
      }
    }

    for (const medId of createdMedicineIds) {
      try {
        await db.medicine.delete({ where: { id: medId } });
        console.log(`  ✓ Removed test medicine: ${medId}`);
      } catch (cleanupErr) {
        console.warn(`  ! Warning cleaning medicine ${medId}:`, cleanupErr);
      }
    }
  }

  // ========================================================================
  // AUDIT SUMMARY
  // ========================================================================
  console.log(`\n========================================================================`);
  console.log(`📊 FINAL AUDIT REPORT SUMMARY`);
  console.log(`========================================================================`);

  const totalPassed = auditRecords.filter((r) => r.passed).length;
  const totalFailed = auditRecords.filter((r) => !r.passed).length;
  const totalTests = auditRecords.length;

  console.log(`Total Audit Assertions: ${totalTests}`);
  console.log(`Passed Assertions:     ${totalPassed}`);
  console.log(`Failed Assertions:     ${totalFailed}`);

  const distinctSuites = Array.from(new Set(auditRecords.map((r) => r.suite)));
  for (const s of distinctSuites) {
    const sTests = auditRecords.filter((r) => r.suite === s);
    const sPass = sTests.filter((r) => r.passed).length;
    console.log(`  • ${s}: ${sPass}/${sTests.length} Passed`);
  }

  console.log(`========================================================================\n`);

  if (totalFailed > 0) {
    console.error(`💥 POS Billing Engine Audit FAILED with ${totalFailed} failure(s).`);
    process.exit(1);
  } else {
    console.log(`🎉 ALL ${totalPassed} POS BILLING & CHECKOUT AUDIT ASSERTIONS PASSED!`);
    process.exit(0);
  }
}

runAudit().catch((e) => {
  console.error('Fatal audit runner error:', e);
  process.exit(1);
});
