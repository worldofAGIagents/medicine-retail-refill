import {
  isInfantFormula,
  getDefaultDiscountPercent,
  calculateLineItem,
  calculateBillSummary,
  generateInvoiceNumber,
  generateWhatsAppBillText,
} from '../src/lib/billing-engine';
import { db } from '../src/lib/db';

async function runBillingTests() {
  console.log('🧪 Starting Billing Engine & Retail POS Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Test Infant Formula Detection
  console.log('--- 1. Testing Infant Formula vs Standard Medicine Detection ---');
  assert(isInfantFormula('Lactogen 1 400g Tin', '', 'Infant Milk') === true, 'Lactogen 1 is identified as Infant Formula');
  assert(isInfantFormula('Nan Pro 2 Formula', '', '') === true, 'Nan Pro is identified as Infant Formula');
  assert(isInfantFormula('Aptamil Stage 1', '', '') === true, 'Aptamil is identified as Infant Formula');
  assert(isInfantFormula('Similac Plus', '', '') === true, 'Similac is identified as Infant Formula');
  assert(isInfantFormula('Dexolac Powder', '', '') === true, 'Dexolac is identified as Infant Formula');
  assert(isInfantFormula('Cerelac Wheat Apple', '', '') === true, 'Cerelac is identified as Infant Formula');
  assert(isInfantFormula('Telma 40 Tablet', 'Telmisartan', 'Blood Pressure') === false, 'Telma 40 is NOT Infant Formula');
  assert(isInfantFormula('Glycomet-SR 500mg', 'Metformin', 'Diabetes') === false, 'Glycomet is NOT Infant Formula');
  assert(isInfantFormula('Thyronorm 50mcg', 'Levothyroxine', 'Thyroid') === false, 'Thyronorm is NOT Infant Formula');
  assert(isInfantFormula('Pantocid 40', 'Pantoprazole', 'Gastric') === false, 'Pantocid is NOT Infant Formula');

  // 2. Test Default Discount Rules (10% normal, 0% infant milk)
  console.log('\n--- 2. Testing Default Discount Percent Rules ---');
  assert(getDefaultDiscountPercent('Telma 40', 'Telmisartan', 'Blood Pressure') === 10, 'Telma 40 defaults to 10% discount');
  assert(getDefaultDiscountPercent('Glycomet 500', 'Metformin', 'Diabetes') === 10, 'Glycomet defaults to 10% discount');
  assert(getDefaultDiscountPercent('Pantocid 40', 'Pantoprazole', 'Gastric') === 10, 'Pantocid defaults to 10% discount');
  assert(getDefaultDiscountPercent('Lactogen 1 400g', 'Infant formula', 'Infant Milk') === 0, 'Lactogen defaults to 0% discount');
  assert(getDefaultDiscountPercent('Nan Pro 1', '', '') === 0, 'Nan Pro defaults to 0% discount');
  assert(getDefaultDiscountPercent('Aptamil 1', '', '') === 0, 'Aptamil defaults to 0% discount');

  // 3. Test Line Item Calculations
  console.log('\n--- 3. Testing Line Item Calculations ---');
  const telmaLine = calculateLineItem({
    name: 'Telma 40',
    mrp: 120,
    quantity: 2,
    // discountPercent omitted -> should use default 10%
  });
  assert(telmaLine.grossTotal === 240, 'Telma 2 strips @ ₹120 gross is ₹240');
  assert(telmaLine.discountPercent === 10, 'Telma automatically gets 10% discount');
  assert(telmaLine.discountAmount === 24, 'Telma 10% discount of ₹240 is ₹24');
  assert(telmaLine.netTotal === 216, 'Telma net total is ₹216 (240 - 24)');

  const lactogenLine = calculateLineItem({
    name: 'Lactogen 1 400g Tin',
    mrp: 450,
    quantity: 1,
    // discountPercent omitted -> should use default 0%
  });
  assert(lactogenLine.grossTotal === 450, 'Lactogen gross is ₹450');
  assert(lactogenLine.discountPercent === 0, 'Lactogen automatically gets 0% discount');
  assert(lactogenLine.discountAmount === 0, 'Lactogen discount is ₹0');
  assert(lactogenLine.netTotal === 450, 'Lactogen net total is ₹450');

  // Test Editable Discount Override (e.g. custom 15% on Telma)
  const telmaOverride = calculateLineItem({
    name: 'Telma 40',
    mrp: 120,
    quantity: 1,
    discountPercent: 15, // Custom 15% discount
  });
  assert(telmaOverride.discountPercent === 15, 'Discount override to 15% accepted');
  assert(telmaOverride.discountAmount === 18, '15% of ₹120 is ₹18');
  assert(telmaOverride.netTotal === 102, 'Net total after 15% discount is ₹102');

  // Test Flat ₹ Discount Override (e.g. flat ₹20 off)
  const flatDiscountLine = calculateLineItem({
    name: 'Syrup Benadryl',
    mrp: 150,
    quantity: 1,
    customDiscountAmount: 20,
  });
  assert(flatDiscountLine.discountAmount === 20, 'Flat ₹20 discount applied');
  assert(flatDiscountLine.netTotal === 130, 'Net total after ₹20 discount is ₹130');

  // 4. Test Bill Summary Totals & Roundoff
  console.log('\n--- 4. Testing Multi-Item Bill Summary & Totals ---');
  const bill = calculateBillSummary(
    [
      { name: 'Telma 40', mrp: 120, quantity: 2 }, // 240 gross, 24 disc, 216 net
      { name: 'Lactogen 1', mrp: 450, quantity: 1 }, // 450 gross, 0 disc, 450 net
      { name: 'Pantocid 40', mrp: 155, quantity: 1, discountPercent: 10 }, // 155 gross, 15.5 disc, 139.5 net
    ],
    {
      customerName: 'Ramesh Verma',
      customerPhone: '9876543210',
      customerVillage: 'Sarfuddinpur',
      paymentMode: 'upi',
    }
  );

  assert(bill.totalItems === 3, 'Bill contains 3 items');
  assert(bill.totalQuantity === 4, 'Bill total quantity is 4 units (2+1+1)');
  assert(bill.grossAmount === 845, 'Gross MRP subtotal is ₹845 (240+450+155)');
  assert(bill.totalDiscount === 39.5, 'Total discount is ₹39.5 (24+0+15.5)');
  assert(bill.netPayable === 806, 'Net payable rounded to nearest integer is ₹806 (845 - 39.5 = 805.5 -> 806)');
  assert(bill.savingsPercent === 4.7, 'Customer savings percentage computed correctly (4.7%)');

  // 5. Test WhatsApp Receipt Text Generation
  console.log('\n--- 5. Testing WhatsApp Receipt Formatting ---');
  const waText = generateWhatsAppBillText(bill, {
    name: 'Manoj Medical Hall',
    address: 'Sarfuddinpur, Muzaffarpur',
    phone: '9431422744',
    upiId: 'manojmedical@okhdfcbank',
    upiPayeeName: 'Manoj Medical Hall',
  });

  assert(waText.includes('MANOJ MEDICAL HALL'), 'WhatsApp receipt contains pharmacy name');
  assert(waText.includes('Ramesh Verma'), 'WhatsApp receipt contains customer name');
  assert(waText.includes('Telma 40'), 'WhatsApp receipt contains medicine name');
  assert(waText.includes('Lactogen 1'), 'WhatsApp receipt contains infant milk name');
  assert(waText.includes('NET AMOUNT PAYABLE: ₹806'), 'WhatsApp receipt contains net payable ₹806');
  assert(waText.includes('upi://pay?pa=manojmedical%40okhdfcbank'), 'WhatsApp receipt contains valid UPI deep link');

  // 6. Test DB Order Creation via API model
  console.log('\n--- 6. Testing DB Persistence for Retail Orders ---');
  let customer = await db.customer.findFirst();
  if (!customer) {
    customer = await db.customer.create({
      data: {
        name: 'Test Customer',
        phone: '9888877777',
        primaryCondition: 'Blood Pressure',
      },
    });
  }

  const testOrder = await db.order.create({
    data: {
      customerId: customer.id,
      totalAmount: 806,
      status: 'delivered',
      paymentMode: 'upi',
      paymentStatus: 'collected',
      amountCollected: 806,
      deliveryAddress: 'Store Counter Walk-in',
      notes: JSON.stringify({
        invoiceNo: 'MMH-TEST-001',
        orderType: 'retail',
        grossAmount: 845,
        totalDiscount: 39.5,
      }),
      items: {
        create: [
          { medicineName: 'Telma 40', quantity: 2, unitPrice: 108, totalPrice: 216 },
          { medicineName: 'Lactogen 1', quantity: 1, unitPrice: 450, totalPrice: 450 },
        ],
      },
    },
    include: { items: true },
  });

  assert(testOrder.id !== undefined, 'Retail order saved to DB with ID');
  assert(testOrder.items.length === 2, 'Retail order items persisted in DB');
  assert(testOrder.status === 'delivered', 'POS retail order status marked as delivered');

  // Cleanup test order
  await db.order.delete({ where: { id: testOrder.id } });
  console.log('  🧹 Cleaned up test order from DB');

  console.log(`\n========================================`);
  console.log(`TEST RUN COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runBillingTests()
  .catch((e) => {
    console.error('Test execution error:', e);
    process.exit(1);
  });
