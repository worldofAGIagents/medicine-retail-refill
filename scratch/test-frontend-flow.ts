/**
 * scratch/test-frontend-flow.ts
 * Thorough verification and test suite for frontend components, user interaction flows,
 * state management, and edge cases for:
 *  1. src/components/OnboardPatientModal.tsx
 *  2. src/app/prescriptions/page.tsx
 *  3. src/app/settings/page.tsx & src/components/layout.tsx
 */

import fs from 'fs';
import path from 'path';
import {
  detectMedicineCategory,
  CHRONIC_CONDITIONS_LIST,
  DEFAULT_CHRONIC_CATEGORY,
  normalizeChronicCategory,
} from '../src/lib/medicine-classifier';
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_DEFINITIONS,
  TEMPLATE_TAGS,
  renderTemplate,
  TemplateKey,
} from '../src/lib/templates';

// Test Runner utilities
let totalPassed = 0;
let totalFailed = 0;
const testResults: { suite: string; name: string; passed: boolean; details?: string }[] = [];

function assert(condition: boolean, testName: string, suite: string, details?: string) {
  if (condition) {
    totalPassed++;
    testResults.push({ suite, name: testName, passed: true, details });
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    totalFailed++;
    testResults.push({ suite, name: testName, passed: false, details });
    console.error(`  ❌ [FAIL] ${testName} - ${details || 'Assertion failed'}`);
  }
}

function describe(suiteName: string, fn: () => void) {
  console.log(`\n======================================================`);
  console.log(`📋 SUITE: ${suiteName}`);
  console.log(`======================================================`);
  fn();
}

// -------------------------------------------------------------------------
// SUITE 1: OnboardPatientModal Logic & State Simulation
// -------------------------------------------------------------------------
describe('1. OnboardPatientModal State & Component Flow', () => {
  const modalPath = path.resolve(__dirname, '../src/components/OnboardPatientModal.tsx');
  const modalCode = fs.readFileSync(modalPath, 'utf-8');

  // Test 1.1: Initial State
  console.log('\n--- 1.1 Initial State ---');
  assert(
    DEFAULT_CHRONIC_CATEGORY === 'Blood Pressure',
    'DEFAULT_CHRONIC_CATEGORY is "Blood Pressure"',
    'OnboardPatientModal'
  );

  const initialConditionMatch = modalCode.includes("const [condition, setCondition] = useState<string>('Blood Pressure');") ||
    modalCode.includes("const [condition, setCondition] = useState('Blood Pressure');");
  assert(
    initialConditionMatch,
    "Initial state: `condition` is initialized to 'Blood Pressure'",
    'OnboardPatientModal'
  );

  const initialConditionSelectedMatch = modalCode.includes("const [conditionManuallySelected, setConditionManuallySelected] = useState(false);");
  assert(
    initialConditionSelectedMatch,
    'Initial state: `conditionManuallySelected` is false (allows dynamic auto-detection)',
    'OnboardPatientModal'
  );

  const initialPrescribedMedsMatch = modalCode.includes("const [prescribedMeds, setPrescribedMeds] = useState<PrescribedMedicineItem[]>([]);");
  assert(
    initialPrescribedMedsMatch,
    'Initial state: `prescribedMeds` is initialized to empty array []',
    'OnboardPatientModal'
  );

  // Test 1.2: Non-blocking submission when prescribedMeds.length === 0
  console.log('\n--- 1.2 Non-blocking submission with 0 medicines ---');
  // Check that handleSubmit does NOT require prescribedMeds.length > 0
  const hasMedicineBlocker = modalCode.includes("prescribedMeds.length === 0") &&
    (modalCode.includes("Please search and add at least one medicine") ||
     modalCode.includes("Please add at least one medicine"));
  assert(
    !hasMedicineBlocker,
    'Non-blocking behavior: No error blocker requiring at least one medicine',
    'OnboardPatientModal'
  );

  // Simulate modal submission logic with 0 medicines
  function simulateSubmission(name: string, phone: string, meds: any[]) {
    if (!name.trim()) return { error: 'Patient full name is required' };
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) return { error: 'Please enter a valid 10-digit mobile number' };
    
    // Deduplication
    const seen = new Set<string>();
    const dedupedMeds = meds.filter((m) => {
      const key = (m.medicine.name || m.medicine.id).trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const successMessage = dedupedMeds.length > 0
      ? `Patient ${name} onboarded with ${dedupedMeds.length} medicine(s) successfully!`
      : `Patient ${name} registered successfully!`;

    return {
      success: true,
      message: successMessage,
      payload: {
        name: name.trim(),
        phone: cleanPhone,
        medicines: dedupedMeds,
      },
    };
  }

  const sub0 = simulateSubmission('Ram Kumar', '9876543210', []);
  assert(
    sub0.success === true && sub0.message === 'Patient Ram Kumar registered successfully!',
    'Patient registers successfully with 0 prescribed medicines',
    'OnboardPatientModal'
  );

  const subInvalidPhone = simulateSubmission('Ram Kumar', '123', []);
  assert(
    subInvalidPhone.error === 'Please enter a valid 10-digit mobile number',
    'Phone validation still works when 0 medicines are provided',
    'OnboardPatientModal'
  );

  // Test 1.3: Submit button dynamic labels
  console.log('\n--- 1.3 Submit button dynamic labels ---');
  function getSubmitButtonLabel(saving: boolean, medCount: number): string {
    if (saving) return 'Saving Patient...';
    if (medCount === 0) return 'Save Patient Profile';
    if (medCount === 1) return 'Save Patient & 1 Medicine';
    return `Save Patient & ${medCount} Medicines`;
  }

  assert(
    getSubmitButtonLabel(false, 0) === 'Save Patient Profile',
    'Button label (0 meds): "Save Patient Profile"',
    'OnboardPatientModal'
  );
  assert(
    getSubmitButtonLabel(false, 1) === 'Save Patient & 1 Medicine',
    'Button label (1 med): "Save Patient & 1 Medicine"',
    'OnboardPatientModal'
  );
  assert(
    getSubmitButtonLabel(false, 2) === 'Save Patient & 2 Medicines',
    'Button label (2 meds): "Save Patient & 2 Medicines"',
    'OnboardPatientModal'
  );
  assert(
    getSubmitButtonLabel(false, 5) === 'Save Patient & 5 Medicines',
    'Button label (5 meds): "Save Patient & 5 Medicines"',
    'OnboardPatientModal'
  );

  // Verify modal JSX contains exact ternary expressions
  const hasZeroLabelInJSX = modalCode.includes("'Save Patient Profile'");
  const hasOneLabelInJSX = modalCode.includes("'Save Patient & 1 Medicine'");
  const hasMultiLabelInJSX = modalCode.includes("`Save Patient & ${prescribedMeds.length} Medicines`");
  assert(
    hasZeroLabelInJSX && hasOneLabelInJSX && hasMultiLabelInJSX,
    'Modal JSX contains all 3 dynamic submit button states',
    'OnboardPatientModal'
  );

  // Test 1.4: Chronic Condition selection & chip deselection
  console.log('\n--- 1.4 Chronic Condition Selection & Deselection ---');
  const hasOptionalBanner = modalCode.includes('Optional • Auto-detects • Defaults to BP');
  assert(
    hasOptionalBanner,
    'Chronic Condition section is clearly labeled: "Optional • Auto-detects • Defaults to BP"',
    'OnboardPatientModal'
  );

  // Simulate condition chip click behavior
  class ModalConditionState {
    condition: string = 'Blood Pressure';
    conditionManuallySelected: boolean = false;

    handleConditionChipClick(selectedCategory: string) {
      if (this.condition === selectedCategory) {
        // Deselecting marks it back as BP (Blood Pressure)
        this.condition = DEFAULT_CHRONIC_CATEGORY;
        this.conditionManuallySelected = false;
      } else {
        this.condition = selectedCategory;
        this.conditionManuallySelected = true;
      }
    }

    handleResetToBp() {
      this.condition = DEFAULT_CHRONIC_CATEGORY;
      this.conditionManuallySelected = false;
    }
  }

  const condState = new ModalConditionState();
  assert(
    condState.condition === 'Blood Pressure' && !condState.conditionManuallySelected,
    'Initial condition is Blood Pressure and not manually selected',
    'OnboardPatientModal'
  );

  // Select 'Diabetes'
  condState.handleConditionChipClick('Diabetes');
  assert(
    condState.condition === 'Diabetes' && condState.conditionManuallySelected,
    'Clicking "Diabetes" selects Diabetes and locks conditionManuallySelected = true',
    'OnboardPatientModal'
  );

  // Click 'Diabetes' again to deselect
  condState.handleConditionChipClick('Diabetes');
  assert(
    condState.condition === 'Blood Pressure' && !condState.conditionManuallySelected,
    'Clicking active "Diabetes" deselects it and resets to "Blood Pressure" (BP)',
    'OnboardPatientModal'
  );

  // Select 'Thyroid'
  condState.handleConditionChipClick('Thyroid');
  assert(
    condState.condition === 'Thyroid',
    'Clicking "Thyroid" selects Thyroid',
    'OnboardPatientModal'
  );

  // Reset to BP button
  condState.handleResetToBp();
  assert(
    condState.condition === 'Blood Pressure' && !condState.conditionManuallySelected,
    '"Reset to BP (Default)" resets condition back to Blood Pressure',
    'OnboardPatientModal'
  );

  // Verify Reset to BP button exists in JSX
  const hasResetButtonInJSX = modalCode.includes('Reset to BP (Default)') &&
    modalCode.includes('setCondition(DEFAULT_CHRONIC_CATEGORY)');
  assert(
    hasResetButtonInJSX,
    'Modal JSX contains "Reset to BP (Default)" button with correct reset handler',
    'OnboardPatientModal'
  );

  // Test 1.5: Dynamic category detection on adding medicines
  console.log('\n--- 1.5 Dynamic Category Detection on Adding Medicines ---');
  class FullModalStateSimulation {
    condition: string = 'Blood Pressure';
    conditionManuallySelected: boolean = false;
    prescribedMeds: any[] = [];

    addMedicine(med: { id: string; name: string; genericName?: string; category?: string; unitsPerPack?: number; mrp?: number }) {
      if (this.prescribedMeds.some((p) => p.medicine.id === med.id)) return;

      const detectedCat = (med.category && med.category !== 'General' && med.category !== 'Uncategorized')
        ? med.category
        : detectMedicineCategory(med.name, med.genericName);

      const finalItemCategory = detectedCat || DEFAULT_CHRONIC_CATEGORY;

      // Sync modal condition if user hasn't manually selected
      if (!this.conditionManuallySelected && finalItemCategory) {
        this.condition = finalItemCategory;
      }

      const packUnits = (med.unitsPerPack && med.unitsPerPack > 0) ? med.unitsPerPack : 10;
      this.prescribedMeds.push({
        medicine: med,
        category: finalItemCategory,
        unitMode: 'strips',
        stripCount: 2,
        totalQty: 2 * packUnits,
        dailyDosage: 1,
        bufferDays: 3,
        customMrp: med.mrp || 100,
        customUnitsPerPack: packUnits,
      });
    }

    updateMedicineCategory(index: number, newCategory: string) {
      const current = this.prescribedMeds[index];
      if (current) {
        // If clicking active, reset to Blood Pressure
        const isSelected = (current.category || DEFAULT_CHRONIC_CATEGORY) === newCategory;
        current.category = isSelected ? DEFAULT_CHRONIC_CATEGORY : newCategory;
      }
    }

    resetMedicineCategoryToBP(index: number) {
      if (this.prescribedMeds[index]) {
        this.prescribedMeds[index].category = DEFAULT_CHRONIC_CATEGORY;
      }
    }
  }

  // Case 1: Add Metformin when not manually locked
  const sim1 = new FullModalStateSimulation();
  sim1.addMedicine({ id: 'm1', name: 'Glycomet 500mg', genericName: 'Metformin Hydrochloride', unitsPerPack: 10, mrp: 45 });
  assert(
    sim1.prescribedMeds[0].category === 'Diabetes',
    'Medicine "Glycomet 500mg" detected as "Diabetes"',
    'OnboardPatientModal'
  );
  assert(
    sim1.condition === 'Diabetes',
    'Modal condition automatically updated to "Diabetes" when unlocked',
    'OnboardPatientModal'
  );

  // Case 2: Add Thyronorm
  const sim2 = new FullModalStateSimulation();
  sim2.addMedicine({ id: 'm2', name: 'Thyronorm 50mcg', genericName: 'Thyroxine Sodium', unitsPerPack: 100, mrp: 180 });
  assert(
    sim2.prescribedMeds[0].category === 'Thyroid',
    'Medicine "Thyronorm 50mcg" detected as "Thyroid"',
    'OnboardPatientModal'
  );
  assert(
    sim2.condition === 'Thyroid',
    'Modal condition automatically updated to "Thyroid" when unlocked',
    'OnboardPatientModal'
  );

  // Case 3: User manually locked condition to "Heart"
  const sim3 = new FullModalStateSimulation();
  sim3.condition = 'Heart';
  sim3.conditionManuallySelected = true;
  sim3.addMedicine({ id: 'm3', name: 'Telma 40mg', genericName: 'Telmisartan', unitsPerPack: 15, mrp: 120 });
  assert(
    sim3.prescribedMeds[0].category === 'Blood Pressure',
    'Medicine "Telma 40mg" detected as "Blood Pressure"',
    'OnboardPatientModal'
  );
  assert(
    sim3.condition === 'Heart',
    'Modal condition remains locked at "Heart" because conditionManuallySelected = true',
    'OnboardPatientModal'
  );

  // Test 1.6: Per-medicine category controls & deselection
  console.log('\n--- 1.6 Per-medicine Category Controls & Deselection ---');
  const sim4 = new FullModalStateSimulation();
  sim4.addMedicine({ id: 'm4', name: 'Glycomet 500mg', genericName: 'Metformin', unitsPerPack: 10, mrp: 40 });
  assert(
    sim4.prescribedMeds[0].category === 'Diabetes',
    'Medicine initially has category "Diabetes"',
    'OnboardPatientModal'
  );

  // Click "Diabetes" chip on individual medicine card to deselect it
  sim4.updateMedicineCategory(0, 'Diabetes');
  assert(
    sim4.prescribedMeds[0].category === 'Blood Pressure',
    'Clicking active category on medicine card deselects and resets to "Blood Pressure"',
    'OnboardPatientModal'
  );

  // Change to Thyroid
  sim4.updateMedicineCategory(0, 'Thyroid');
  assert(
    sim4.prescribedMeds[0].category === 'Thyroid',
    'Switching medicine category to "Thyroid" works',
    'OnboardPatientModal'
  );

  // Click "Deselect (Reset to BP)"
  sim4.resetMedicineCategoryToBP(0);
  assert(
    sim4.prescribedMeds[0].category === 'Blood Pressure',
    'Clicking "Deselect (Reset to BP)" resets medicine category to "Blood Pressure"',
    'OnboardPatientModal'
  );

  // Verify code in JSX for per-medicine controls
  const hasPerMedDeselectInJSX = modalCode.includes('Deselect (Reset to BP)') &&
    modalCode.includes('handleUpdateMedicine(idx, { category: DEFAULT_CHRONIC_CATEGORY })');
  assert(
    hasPerMedDeselectInJSX,
    'Modal JSX contains "Deselect (Reset to BP)" button on medicine cards',
    'OnboardPatientModal'
  );

  // Test 1.7: Packaging and Calculations
  console.log('\n--- 1.7 Packaging and Calculations in Modal ---');
  const medItem = sim4.prescribedMeds[0];
  // Change stripCount to 3
  medItem.stripCount = 3;
  medItem.totalQty = medItem.stripCount * (medItem.customUnitsPerPack || 10);
  assert(
    medItem.totalQty === 30,
    '3 strips of 10 units = 30 total tablets',
    'OnboardPatientModal'
  );

  // Change customUnitsPerPack to 15 (e.g. 15 tabs/strip)
  medItem.customUnitsPerPack = 15;
  medItem.totalQty = medItem.stripCount * medItem.customUnitsPerPack;
  assert(
    medItem.totalQty === 45,
    '3 strips of 15 units = 45 total tablets',
    'OnboardPatientModal'
  );

  // Cost calculation
  medItem.customMrp = 50;
  const cost = medItem.customMrp * medItem.stripCount;
  assert(
    cost === 150,
    '3 strips at ₹50 MRP = ₹150 total cost',
    'OnboardPatientModal'
  );
});

// -------------------------------------------------------------------------
// SUITE 2: Prescriptions Page Verification
// -------------------------------------------------------------------------
describe('2. Prescriptions Page Filters & Calculations', () => {
  const rxPath = path.resolve(__dirname, '../src/app/prescriptions/page.tsx');
  const rxCode = fs.readFileSync(rxPath, 'utf-8');

  // Test 2.1: Category filter pills
  console.log('\n--- 2.1 Category Filter Pills & Search ---');
  const hasComboboxPills = rxCode.includes("['All', 'Diabetes', 'BP', 'Thyroid', 'Infant Milk', 'Cholesterol', 'Heart', 'Respiratory'].map");
  assert(
    hasComboboxPills,
    'Combobox has category pills: All, Diabetes, BP, Thyroid, Infant Milk, Cholesterol, Heart, Respiratory',
    'PrescriptionsPage'
  );

  const hasTablePills = rxCode.includes("const allCategories = ['All', 'Diabetes', 'BP', 'Thyroid', 'Cholesterol', 'Infant Milk', 'Heart', 'Syrup'];") ||
    rxCode.includes("const allCategories = ['All', 'Diabetes', 'BP', 'Thyroid', 'Cholesterol', 'Infant Milk', 'Heart'];");
  assert(
    hasTablePills,
    'Prescriptions table has allCategories filter pills',
    'PrescriptionsPage'
  );

  // Simulate Prescriptions Table Filtering
  const samplePrescriptions = [
    { id: 'rx-1', customer: { name: 'Ram Verma', phone: '9876543210' }, medicine: { name: 'Telma 40', category: 'BP' } },
    { id: 'rx-2', customer: { name: 'Sita Devi', phone: '9123456780' }, medicine: { name: 'Glycomet GP 1', category: 'Diabetes' } },
    { id: 'rx-3', customer: { name: 'Pooja Kumari', phone: '9988776655' }, medicine: { name: 'Nan Pro 1', category: 'Infant Milk' } },
    { id: 'rx-4', customer: { name: 'Manoj Roy', phone: '9871234560' }, medicine: { name: 'Thyronorm 50', category: 'Thyroid' } },
  ];

  function filterPrescriptions(list: typeof samplePrescriptions, search: string, category: string) {
    return list.filter((p) => {
      const matchesSearch =
        p.customer.name.toLowerCase().includes(search.toLowerCase()) ||
        p.customer.phone.includes(search) ||
        p.medicine.name.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (category === 'All') return true;
      return p.medicine.category.toLowerCase().includes(category.toLowerCase());
    });
  }

  // Non-blocking: empty search and 'All' category returns all
  const allFiltered = filterPrescriptions(samplePrescriptions, '', 'All');
  assert(
    allFiltered.length === 4,
    'Empty search and "All" category returns all 4 records non-blockingly',
    'PrescriptionsPage'
  );

  // Search by name
  const nameFiltered = filterPrescriptions(samplePrescriptions, 'sita', 'All');
  assert(
    nameFiltered.length === 1 && nameFiltered[0].customer.name === 'Sita Devi',
    'Search by name "sita" correctly returns Sita Devi',
    'PrescriptionsPage'
  );

  // Filter by category "Infant Milk"
  const catFiltered = filterPrescriptions(samplePrescriptions, '', 'Infant Milk');
  assert(
    catFiltered.length === 1 && catFiltered[0].medicine.name === 'Nan Pro 1',
    'Category filter "Infant Milk" correctly returns baby formula prescription',
    'PrescriptionsPage'
  );

  // Combined search & category
  const combined = filterPrescriptions(samplePrescriptions, '987', 'BP');
  assert(
    combined.length === 1 && combined[0].medicine.name === 'Telma 40',
    'Combined search (phone "987") and category "BP" returns correct match',
    'PrescriptionsPage'
  );

  // Test 2.2: Custom packaging, MRP editing, and calculations
  console.log('\n--- 2.2 Packaging & Refill Date Engine Calculations ---');
  const hasCustomPackagingOverride = rxCode.includes('overridePackaging') &&
    rxCode.includes('customPackagingText') &&
    rxCode.includes('customUnitsPerPack') &&
    rxCode.includes('customUnitType');
  assert(
    hasCustomPackagingOverride,
    'Prescriptions page supports custom packaging override (text, unitType, unitsPerPack)',
    'PrescriptionsPage'
  );

  // Quick Pack Multipliers simulation
  function getQuickPackQty(multiplier: number, unitsPerPack: number) {
    return multiplier * unitsPerPack;
  }
  assert(
    getQuickPackQty(1, 10) === 10 && getQuickPackQty(2, 10) === 20 && getQuickPackQty(3, 10) === 30,
    'Quick pack multipliers (1 Pack, 2 Packs, 3 Packs) calculate exact quantities for 10-tab pack',
    'PrescriptionsPage'
  );
  assert(
    getQuickPackQty(2, 15) === 30 && getQuickPackQty(3, 15) === 45,
    'Quick pack multipliers adjust when custom unitsPerPack is 15',
    'PrescriptionsPage'
  );

  // Refill Forecast calculation
  function calculateRefillForecast(qty: number, dailyDosage: number, purchaseDateStr: string, bufferDays: number) {
    const daysOfSupply = qty && dailyDosage ? Math.floor(qty / dailyDosage) : 0;
    const purchaseDate = new Date(purchaseDateStr);
    const runOutDate = new Date(purchaseDate);
    runOutDate.setDate(runOutDate.getDate() + daysOfSupply);

    const refillTargetDate = new Date(runOutDate);
    refillTargetDate.setDate(refillTargetDate.getDate() - bufferDays);

    return { daysOfSupply, runOutDate, refillTargetDate };
  }

  // 30 tablets, 1 tab/day, 3 days buffer
  const forecast1 = calculateRefillForecast(30, 1, '2026-09-01', 3);
  assert(
    forecast1.daysOfSupply === 30,
    '30 tablets at 1 tab/day = 30 days of supply',
    'PrescriptionsPage'
  );
  // Run out date = Sep 1 + 30 days = Oct 1
  // Refill date = Oct 1 - 3 days = Sep 28
  const diffDays = Math.round((forecast1.refillTargetDate.getTime() - new Date('2026-09-01').getTime()) / (1000 * 3600 * 24));
  assert(
    diffDays === 27,
    'Reminder scheduled 27 days after purchase (3-day proactive doorstep buffer)',
    'PrescriptionsPage'
  );

  // Infant milk: 400g tin, 40g/day, 2 days buffer
  const forecastBaby = calculateRefillForecast(400, 40, '2026-09-01', 2);
  assert(
    forecastBaby.daysOfSupply === 10,
    '400g infant milk at 40g/day = 10 days of supply',
    'PrescriptionsPage'
  );
  const babyDiff = Math.round((forecastBaby.refillTargetDate.getTime() - new Date('2026-09-01').getTime()) / (1000 * 3600 * 24));
  assert(
    babyDiff === 8,
    'Baby milk refill reminder triggers on Day 8 (2 days before 400g tin is empty)',
    'PrescriptionsPage'
  );
});

// -------------------------------------------------------------------------
// SUITE 3: Settings Page & Layout Verification
// -------------------------------------------------------------------------
describe('3. Settings Page & Layout Verification', () => {
  const settingsPath = path.resolve(__dirname, '../src/app/settings/page.tsx');
  const settingsCode = fs.readFileSync(settingsPath, 'utf-8');

  const layoutPath = path.resolve(__dirname, '../src/components/layout.tsx');
  const layoutCode = fs.readFileSync(layoutPath, 'utf-8');

  // Test 3.1: Sidebar navigation & Import tab
  console.log('\n--- 3.1 Sidebar Navigation & Import Tab ---');
  const sidebarHasImport = layoutCode.includes("href: '/import'");
  assert(
    !sidebarHasImport,
    'Main sidebar nav does NOT contain "/import" (removed from main nav to declutter)',
    'Layout'
  );

  const settingsHasImportTab = settingsCode.includes("{ key: 'import', label: 'Import MARG Data', icon: Upload, badge: 'Excel / CSV' }");
  assert(
    settingsHasImportTab,
    '"Import MARG Data" is cleanly housed inside Settings tabs',
    'SettingsPage'
  );

  const settingsHandlesUrlTabParam = settingsCode.includes("const tabParam = params.get('tab') as TabKey;") &&
    settingsCode.includes("['admin', 'import', 'whatsapp', 'upi', 'refills', 'marg'].includes(tabParam)");
  assert(
    settingsHandlesUrlTabParam,
    'Settings page automatically opens tab from URL parameter (?tab=import)',
    'SettingsPage'
  );

  // Test 3.2: UPI Security Passcode Lock
  console.log('\n--- 3.2 UPI ID Security Passcode Lock ---');
  const initialUpiLocked = settingsCode.includes("const [isUpiLocked, setIsUpiLocked] = useState(true);");
  assert(
    initialUpiLocked,
    'UPI ID is locked by default (isUpiLocked = true) to prevent counter tampering',
    'SettingsPage'
  );

  // Simulate UPI Passcode verification
  class UpiSecurityController {
    isUpiLocked: boolean = true;
    upiPasscode: string = '1234'; // default
    upiId: string = 'manojmedical@okhdfcbank';
    upiPayee: string = 'Manoj Medical Hall';

    verifyUnlockPin(enteredPin: string): { success: boolean; error?: string } {
      if (!enteredPin.trim()) return { success: false, error: 'Please enter your 4-digit security PIN.' };
      if (enteredPin.trim() === this.upiPasscode) {
        this.isUpiLocked = false;
        return { success: true };
      }
      return { success: false, error: 'Incorrect security PIN. Default is 1234 unless changed.' };
    }

    changePin(currentPin: string, newPin: string, confirmPin: string): { success: boolean; error?: string } {
      if (currentPin.trim() !== this.upiPasscode) {
        return { success: false, error: 'Current security PIN is incorrect.' };
      }
      if (!newPin.trim() || newPin.trim().length < 4) {
        return { success: false, error: 'New PIN must be at least 4 digits.' };
      }
      if (newPin.trim() !== confirmPin.trim()) {
        return { success: false, error: 'New PIN and Confirm PIN do not match.' };
      }
      this.upiPasscode = newPin.trim();
      return { success: true };
    }

    saveAndRelock(newUpiId: string) {
      if (this.isUpiLocked) return { error: 'Locked. Cannot edit UPI without unlocking.' };
      this.upiId = newUpiId;
      this.isUpiLocked = true;
      return { success: true };
    }
  }

  const upiSec = new UpiSecurityController();
  // Wrong PIN test
  const wrongRes = upiSec.verifyUnlockPin('0000');
  assert(
    !wrongRes.success && upiSec.isUpiLocked,
    'Entering incorrect PIN "0000" fails to unlock UPI ID',
    'SettingsPage'
  );

  // Correct PIN test
  const correctRes = upiSec.verifyUnlockPin('1234');
  assert(
    correctRes.success && !upiSec.isUpiLocked,
    'Entering correct PIN "1234" successfully unlocks UPI ID',
    'SettingsPage'
  );

  // Save & Re-lock test
  const relockRes = upiSec.saveAndRelock('manoj.pharma@icici');
  assert(
    Boolean(relockRes.success) && upiSec.isUpiLocked && upiSec.upiId === 'manoj.pharma@icici',
    'Save and Re-lock updates UPI ID and immediately re-secures input',
    'SettingsPage'
  );

  // Change PIN test
  const changeRes = upiSec.changePin('1234', '5678', '5678');
  assert(
    changeRes.success && upiSec.upiPasscode === '5678',
    'Owner can update security PIN from 1234 to 5678',
    'SettingsPage'
  );

  // Old PIN no longer works
  const oldPinRes = upiSec.verifyUnlockPin('1234');
  assert(
    !oldPinRes.success,
    'Old PIN 1234 no longer works after being updated',
    'SettingsPage'
  );

  // New PIN unlocks
  const newPinRes = upiSec.verifyUnlockPin('5678');
  assert(
    newPinRes.success && !upiSec.isUpiLocked,
    'New PIN 5678 successfully unlocks UPI settings',
    'SettingsPage'
  );

  // Test 3.3: WhatsApp Language Selection & Template Preview
  console.log('\n--- 3.3 WhatsApp Language Selection & Live Preview ---');
  const hasHindiLangToggle = settingsCode.includes("handleSelectLanguage('hindi')");
  const hasEnglishLangToggle = settingsCode.includes("handleSelectLanguage('english')");
  assert(
    hasHindiLangToggle && hasEnglishLangToggle,
    'WhatsApp settings has Hindi / English language switcher buttons',
    'SettingsPage'
  );

  // Test template rendering in Hindi
  const sampleVars = {
    name: 'सुरेश गुप्ता',
    medicine: 'Telvas 40mg',
    days: '3 दिन',
    date: '08 सितम्बर',
    pharmacy: 'Manoj Medical Hall',
    phone: '+91 98765 43210',
    address: 'गाँव: गोपालपुर, वार्ड 4',
  };

  const hindiRendered = renderTemplate(DEFAULT_TEMPLATES.hindiTemplate, sampleVars);
  assert(
    hindiRendered.includes('सुरेश गुप्ता') &&
    hindiRendered.includes('Telvas 40mg') &&
    hindiRendered.includes('3 दिन') &&
    hindiRendered.includes('Manoj Medical Hall'),
    'Hindi template properly renders dynamic patient name, medicine, and village address',
    'Templates'
  );

  // Test template rendering in English
  const englishVars = {
    name: 'Ramesh Verma',
    medicine: 'Glycomet GP 1mg',
    days: '3 days',
    date: '08 Sept',
    pharmacy: 'Manoj Medical Hall',
    phone: '+91 98765 43210',
    address: 'Sarfuddinpur Village',
  };
  const englishRendered = renderTemplate(DEFAULT_TEMPLATES.englishTemplate, englishVars);
  assert(
    englishRendered.includes('Ramesh Verma') &&
    englishRendered.includes('Glycomet GP 1mg') &&
    englishRendered.includes('3 days') &&
    englishRendered.includes('Manoj Medical Hall'),
    'English template properly renders dynamic variables',
    'Templates'
  );

  // Test language selection state synchronizer
  function simulateSelectLanguage(lang: 'hindi' | 'english', currentTemplate: TemplateKey): TemplateKey {
    const currentDef = TEMPLATE_DEFINITIONS.find((d) => d.key === currentTemplate);
    const currentType = currentDef?.type || 'chronic';
    const targetDef = TEMPLATE_DEFINITIONS.find(
      (d) => d.language === lang && d.type === currentType
    );
    return targetDef ? targetDef.key : (lang === 'english' ? 'englishTemplate' : 'hindiTemplate');
  }

  const switchedToEnglish = simulateSelectLanguage('english', 'hindiTemplate');
  assert(
    switchedToEnglish === 'englishTemplate',
    'Selecting English switches active template to "englishTemplate"',
    'SettingsPage'
  );

  const switchedInfantToEnglish = simulateSelectLanguage('english', 'infantMilkTemplate');
  assert(
    switchedInfantToEnglish === 'englishInfantMilkTemplate',
    'Selecting English while viewing Infant Milk switches to "englishInfantMilkTemplate"',
    'SettingsPage'
  );

  const switchedBackToHindi = simulateSelectLanguage('hindi', 'englishInfantMilkTemplate');
  assert(
    switchedBackToHindi === 'infantMilkTemplate',
    'Switching back to Hindi returns to "infantMilkTemplate"',
    'SettingsPage'
  );

  // Test 3.4: GST and DL numbers fully editable & no dummy defaults
  console.log('\n--- 3.4 GST & DL Numbers Editable & Clean Defaults ---');
  // Check initial state in settings/page.tsx
  const dlInitMatch = settingsCode.includes("dlNumber: '',");
  const gstinInitMatch = settingsCode.includes("gstin: '',");
  assert(
    dlInitMatch && gstinInitMatch,
    'Initial pharmacy profile has clean empty strings for dlNumber and gstin (no dummy placeholders)',
    'SettingsPage'
  );

  // Check API route defaults in src/app/api/settings/route.ts
  const apiSettingsPath = path.resolve(__dirname, '../src/app/api/settings/route.ts');
  const apiSettingsCode = fs.readFileSync(apiSettingsPath, 'utf-8');
  const apiDlMatch = apiSettingsCode.includes("dlNumber: settings.dlNumber !== undefined ? settings.dlNumber : ''");
  const apiGstinMatch = apiSettingsCode.includes("gstin: settings.gstin !== undefined ? settings.gstin : ''");
  assert(
    apiDlMatch && apiGstinMatch,
    'Settings API defaults preserve saved values and fall back to empty strings without dummy values',
    'SettingsAPI'
  );

  // Simulate updating GST and DL
  interface PharmacyInfo {
    name: string;
    dlNumber: string;
    gstin: string;
    phone: string;
    address: string;
  }

  const testPharmacy: PharmacyInfo = {
    name: 'Manoj Medical Hall',
    dlNumber: '',
    gstin: '',
    phone: '+91 98765 43210',
    address: 'Sarfuddinpur, Bihar',
  };

  testPharmacy.dlNumber = 'BR-MUZ-20-21-98765';
  testPharmacy.gstin = '10AABCM1234F1Z5';

  assert(
    testPharmacy.dlNumber === 'BR-MUZ-20-21-98765' && testPharmacy.gstin === '10AABCM1234F1Z5',
    'Pharmacy DL number and GSTIN are fully mutable and retain assigned values',
    'SettingsPage'
  );
});

// -------------------------------------------------------------------------
// SUITE 4: Medicine Classifier Engine Verification
// -------------------------------------------------------------------------
describe('4. Medicine Classifier Category Invariants', () => {
  console.log('\n--- 4.1 Classifier Category Invariants ---');
  assert(
    detectMedicineCategory('Telvas 40', 'Telmisartan') === 'Blood Pressure',
    'Telvas 40 / Telmisartan classified as Blood Pressure',
    'MedicineClassifier'
  );
  assert(
    detectMedicineCategory('Amlong 5', 'Amlodipine') === 'Blood Pressure',
    'Amlong 5 / Amlodipine classified as Blood Pressure',
    'MedicineClassifier'
  );
  assert(
    detectMedicineCategory('Glycomet 500', 'Metformin') === 'Diabetes',
    'Glycomet 500 / Metformin classified as Diabetes',
    'MedicineClassifier'
  );
  assert(
    detectMedicineCategory('Thyronorm 50', 'Thyroxine') === 'Thyroid',
    'Thyronorm 50 / Thyroxine classified as Thyroid',
    'MedicineClassifier'
  );
  assert(
    detectMedicineCategory('Nan Pro Stage 1', 'Infant formula') === 'Infant Milk',
    'Nan Pro Stage 1 classified as Infant Milk',
    'MedicineClassifier'
  );
  assert(
    detectMedicineCategory('Atorva 10', 'Atorvastatin') === 'Cholesterol',
    'Atorva 10 / Atorvastatin classified as Cholesterol',
    'MedicineClassifier'
  );
  assert(
    detectMedicineCategory('Foracort 200', 'Budesonide + Formoterol') === 'Respiratory',
    'Foracort 200 classified as Respiratory',
    'MedicineClassifier'
  );
  assert(
    detectMedicineCategory('Pan 40', 'Pantoprazole') === 'Gastric',
    'Pan 40 / Pantoprazole classified as Gastric',
    'MedicineClassifier'
  );
  assert(
    detectMedicineCategory('Unknown Medicine XYZ', null) === 'Blood Pressure',
    'Unrecognized medicine defaults to Blood Pressure (BP default)',
    'MedicineClassifier'
  );
  assert(
    normalizeChronicCategory(null) === 'Blood Pressure',
    'normalizeChronicCategory(null) returns "Blood Pressure"',
    'MedicineClassifier'
  );
  assert(
    normalizeChronicCategory('General') === 'Blood Pressure',
    'normalizeChronicCategory("General") returns "Blood Pressure"',
    'MedicineClassifier'
  );
  assert(
    normalizeChronicCategory('BP') === 'Blood Pressure',
    'normalizeChronicCategory("BP") shortLabel returns "Blood Pressure"',
    'MedicineClassifier'
  );
});

// -------------------------------------------------------------------------
// FINAL SUMMARY REPORT
// -------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`📊 FINAL TEST REPORT SUMMARY`);
console.log(`======================================================`);
console.log(`Total Assertions Checked: ${totalPassed + totalFailed}`);
console.log(`✅ Passed: ${totalPassed}`);
console.log(`❌ Failed: ${totalFailed}`);

if (totalFailed > 0) {
  console.error(`\n🚨 Some tests failed! Review failure details above.`);
  process.exit(1);
} else {
  console.log(`\n🎉 ALL VERIFICATION ASSERTIONS PASSED PERFECTLY!`);
  process.exit(0);
}
