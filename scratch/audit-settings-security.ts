/**
 * scratch/audit-settings-security.ts
 *
 * Exhaustive Audit and Verification Suite for:
 * 1. Pharmacy Settings API & Data Persistence (Phone, GSTIN, DL Number)
 * 2. UPI ID Security Lock (Protected by Passcode MANOJ2026)
 * 3. WhatsApp Language Settings (Hindi vs English isolation, dynamic variables, UPI payment links)
 * 4. Layout & Navigation (Sidebar links, Import Data relocated to Settings)
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { db } from '../src/lib/db';
import { GET as getSettings, POST as saveSettings } from '../src/app/api/settings/route';
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_DEFINITIONS,
  TEMPLATE_TAGS,
  renderTemplate,
  TemplateKey,
} from '../src/lib/templates';
import { generateWhatsAppBillText } from '../src/lib/billing-engine';

interface AuditTestCase {
  section: string;
  name: string;
  passed: boolean;
  details?: string;
  durationMs: number;
}

const auditLog: AuditTestCase[] = [];

async function auditTest(section: string, name: string, fn: () => Promise<void> | void) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    auditLog.push({ section, name, passed: true, durationMs });
    console.log(`  \x1b[32m✔ PASS\x1b[0m [${durationMs}ms] ${name}`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    auditLog.push({ section, name, passed: false, details: err?.message || String(err), durationMs });
    console.error(`  \x1b[31m✘ FAIL\x1b[0m [${durationMs}ms] ${name}`);
    console.error(`    \x1b[33mError: ${err?.message || err}\x1b[0m`);
    if (err?.stack) {
      console.error(`    ${err.stack.split('\n').slice(1, 3).join('\n    ')}`);
    }
  }
}

async function runAudit() {
  console.log('\n======================================================================');
  console.log('  PHARMACY SETTINGS, UPI SECURITY & LAYOUT COMPREHENSIVE AUDIT');
  console.log('======================================================================\n');

  // Backup original pharmacy settings to guarantee non-destructive testing
  const originalSettingsRows = await db.pharmacySetting.findMany();
  console.log(`[Setup] Backed up ${originalSettingsRows.length} existing pharmacySetting rows.`);

  try {
    // =========================================================================
    // SECTION 1: Pharmacy Settings API & Data Persistence
    // =========================================================================
    console.log('\n\x1b[36m▶ 1. Pharmacy Settings API & Data Persistence\x1b[0m');

    await auditTest('Settings Persistence', '1.1 Set custom phone (9431422744) & verify persistence via GET /api/settings', async () => {
      const postReq = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '9431422744' }),
      });
      const postRes = await saveSettings(postReq);
      assert.strictEqual(postRes.status, 200, `POST /api/settings failed with status ${postRes.status}`);

      const getRes = await getSettings(new Request('http://localhost:3000/api/settings'));
      const data = await getRes.json();
      assert.strictEqual(data.phone, '9431422744', `Expected phone '9431422744', received '${data.phone}'`);
      assert.notStrictEqual(data.phone, '+91 98765 43210', 'Phone must not revert to mock +91 98765 43210');
    });

    await auditTest('Settings Persistence', '1.2 Clear phone to empty string & verify NEVER reverts to mock +91 98765 43210', async () => {
      const clearReq = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '' }),
      });
      const clearRes = await saveSettings(clearReq);
      assert.strictEqual(clearRes.status, 200);

      const getRes = await getSettings(new Request('http://localhost:3000/api/settings'));
      const data = await getRes.json();
      assert.strictEqual(data.phone, '', `Cleared phone should persist as '', received '${data.phone}'`);
      assert.notStrictEqual(data.phone, '+91 98765 43210', 'Empty phone must NEVER revert to mock +91 98765 43210');
    });

    await auditTest('Settings Persistence', '1.3 Verify DB row deletion fallback for phone NEVER returns mock +91 98765 43210', async () => {
      // Temporarily remove phone row completely from DB to test raw fallback
      await db.pharmacySetting.deleteMany({ where: { key: 'phone' } });

      const getRes = await getSettings(new Request('http://localhost:3000/api/settings'));
      const data = await getRes.json();
      assert.strictEqual(data.phone, '', `Missing DB phone setting must default to '', got '${data.phone}'`);
      assert.notStrictEqual(data.phone, '+91 98765 43210', 'Raw fallback must never be mock phone');
    });

    await auditTest('Settings Persistence', '1.4 Set custom GSTIN and DL & verify persistence via GET /api/settings', async () => {
      const customPayload = {
        gstin: '10AABCM5678P1Z3',
        dlNumber: 'BR-MUZ-20B-998877',
      };
      const postReq = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customPayload),
      });
      const postRes = await saveSettings(postReq);
      assert.strictEqual(postRes.status, 200);

      const getRes = await getSettings(new Request('http://localhost:3000/api/settings'));
      const data = await getRes.json();
      assert.strictEqual(data.gstin, '10AABCM5678P1Z3', `Expected GSTIN '10AABCM5678P1Z3', got '${data.gstin}'`);
      assert.strictEqual(data.dlNumber, 'BR-MUZ-20B-998877', `Expected DL 'BR-MUZ-20B-998877', got '${data.dlNumber}'`);
      assert.notStrictEqual(data.gstin, '07AAAAA0000A1Z5', 'GSTIN must not revert to mock 07AAAAA0000A1Z5');
      assert.notStrictEqual(data.dlNumber, 'DL-2024-001234', 'DL must not revert to mock DL-2024-001234');
    });

    await auditTest('Settings Persistence', '1.5 Clear GSTIN and DL to empty strings & verify NEVER revert to mock values', async () => {
      const clearPayload = {
        gstin: '',
        dlNumber: '',
      };
      const clearReq = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clearPayload),
      });
      const clearRes = await saveSettings(clearReq);
      assert.strictEqual(clearRes.status, 200);

      const getRes = await getSettings(new Request('http://localhost:3000/api/settings'));
      const data = await getRes.json();
      assert.strictEqual(data.gstin, '', `Cleared GSTIN must persist as empty string '', got '${data.gstin}'`);
      assert.strictEqual(data.dlNumber, '', `Cleared DL must persist as empty string '', got '${data.dlNumber}'`);
      assert.notStrictEqual(data.gstin, '07AAAAA0000A1Z5', 'Cleared GSTIN must never revert to mock 07AAAAA0000A1Z5');
      assert.notStrictEqual(data.dlNumber, 'DL-2024-001234', 'Cleared DL must never revert to mock DL-2024-001234');
    });

    await auditTest('Settings Persistence', '1.6 Verify Settings frontend component initializes phone, GSTIN, DL with clean empty values', () => {
      const settingsPagePath = path.resolve(__dirname, '../src/app/settings/page.tsx');
      const settingsSource = fs.readFileSync(settingsPagePath, 'utf-8');

      // Check pharmacyInfo initial state
      assert.ok(settingsSource.includes("dlNumber: ''"), 'dlNumber initialized to empty string');
      assert.ok(settingsSource.includes("gstin: ''"), 'gstin initialized to empty string');
      assert.ok(settingsSource.includes("phone: ''"), 'phone initialized to empty string');

      // Check localStorage sanity clean-up
      assert.ok(
        settingsSource.includes("if (parsed.phone === '+91 98765 43210') parsed.phone = ''"),
        'Stale mock phone in browser storage is proactively sanitized'
      );
    });

    // =========================================================================
    // SECTION 2: UPI ID Security Lock
    // =========================================================================
    console.log('\n\x1b[36m▶ 2. UPI ID Security Lock\x1b[0m');

    await auditTest('UPI Security Lock', '2.1 Verify default UPI passcode is MANOJ2026 in GET /api/settings', async () => {
      // Ensure no custom upiPasscode in DB first
      await db.pharmacySetting.deleteMany({ where: { key: 'upiPasscode' } });

      const getRes = await getSettings(new Request('http://localhost:3000/api/settings'));
      const data = await getRes.json();
      assert.strictEqual(data.upiPasscode, 'MANOJ2026', `Expected default upiPasscode 'MANOJ2026', received '${data.upiPasscode}'`);
    });

    await auditTest('UPI Security Lock', '2.2 Verify unauthorized attempt WITHOUT passcode CANNOT change UPI ID (HTTP 403)', async () => {
      const unauthorizedPayload = {
        upiId: 'malicious.attacker@okhdfcbank',
      };
      const req = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unauthorizedPayload),
      });
      const res = await saveSettings(req);
      assert.strictEqual(res.status, 403, `Expected HTTP 403 Forbidden on unauthorized UPI change, got ${res.status}`);

      const body = await res.json();
      assert.ok(body.error && body.error.includes('passcode'), 'Error response must indicate passcode required');

      // Verify DB was NOT updated
      const currentRes = await getSettings(new Request('http://localhost:3000/api/settings'));
      const currentData = await currentRes.json();
      assert.notStrictEqual(currentData.upiId, 'malicious.attacker@okhdfcbank', 'Unauthorized change must not affect DB');
    });

    await auditTest('UPI Security Lock', '2.3 Verify unauthorized attempt with WRONG passcode CANNOT change UPI ID (HTTP 403)', async () => {
      const wrongPinPayload = {
        upiId: 'fraudulent@ybl',
        upiPasscode: 'WRONGPIN999',
      };
      const req = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wrongPinPayload),
      });
      const res = await saveSettings(req);
      assert.strictEqual(res.status, 403, `Expected HTTP 403 on wrong passcode, got ${res.status}`);

      // Verify DB was NOT updated
      const currentRes = await getSettings(new Request('http://localhost:3000/api/settings'));
      const currentData = await currentRes.json();
      assert.notStrictEqual(currentData.upiId, 'fraudulent@ybl', 'Wrong passcode must not update UPI ID');
    });

    await auditTest('UPI Security Lock', '2.4 Verify authorized attempt with passcode MANOJ2026 SUCCEEDS and updates settings', async () => {
      const validPayload = {
        upiId: 'manojmedical.retail@okaxis',
        upiPayeeName: 'Manoj Medical Hall Muzaffarpur',
        upiPasscode: 'MANOJ2026',
      };
      const req = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });
      const res = await saveSettings(req);
      assert.strictEqual(res.status, 200, `Authorized update should return HTTP 200, got ${res.status}`);

      const body = await res.json();
      assert.strictEqual(body.success, true);

      // Verify DB reflects updated UPI settings
      const currentRes = await getSettings(new Request('http://localhost:3000/api/settings'));
      const currentData = await currentRes.json();
      assert.strictEqual(currentData.upiId, 'manojmedical.retail@okaxis', 'UPI ID successfully updated in DB');
      assert.strictEqual(currentData.upiPayeeName, 'Manoj Medical Hall Muzaffarpur', 'UPI Payee Name updated in DB');
    });

    await auditTest('UPI Security Lock', '2.5 Verify updating other settings (e.g. pharmacyName) does not require UPI passcode', async () => {
      const namePayload = {
        pharmacyName: 'Manoj Medical Hall Sarfuddinpur',
      };
      const req = new Request('http://localhost:3000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(namePayload),
      });
      const res = await saveSettings(req);
      assert.strictEqual(res.status, 200, 'Non-UPI setting update must succeed without passcode');

      const currentRes = await getSettings(new Request('http://localhost:3000/api/settings'));
      const currentData = await currentRes.json();
      assert.strictEqual(currentData.pharmacyName, 'Manoj Medical Hall Sarfuddinpur');
    });

    await auditTest('UPI Security Lock', '2.6 Verify Frontend UI Passcode Lock implementation in src/app/settings/page.tsx', () => {
      const settingsPagePath = path.resolve(__dirname, '../src/app/settings/page.tsx');
      const settingsSource = fs.readFileSync(settingsPagePath, 'utf-8');

      assert.ok(
        settingsSource.includes("const [upiPasscode, setUpiPasscode] = useState('MANOJ2026');"),
        'Initial state for upiPasscode is MANOJ2026'
      );
      assert.ok(
        settingsSource.includes('const [isUpiLocked, setIsUpiLocked] = useState(true);'),
        'UPI settings UI starts locked by default'
      );
      assert.ok(
        settingsSource.includes('disabled={isUpiLocked}'),
        'UPI ID and Payee input fields are disabled while locked'
      );
      assert.ok(
        settingsSource.includes('MANOJ2026'),
        'UI instructions clearly specify passcode MANOJ2026'
      );
    });

    // =========================================================================
    // SECTION 3: WhatsApp Language Settings
    // =========================================================================
    console.log('\n\x1b[36m▶ 3. WhatsApp Language Settings\x1b[0m');

    await auditTest('WhatsApp Language', '3.1 Verify language selection options (hindi vs english) and definitions', () => {
      const hindiDefs = TEMPLATE_DEFINITIONS.filter((d) => d.language === 'hindi');
      const englishDefs = TEMPLATE_DEFINITIONS.filter((d) => d.language === 'english');

      assert.strictEqual(hindiDefs.length, 4, 'There must be exactly 4 Hindi template definitions');
      assert.strictEqual(englishDefs.length, 4, 'There must be exactly 4 English template definitions');

      const hindiKeys = hindiDefs.map((d) => d.key);
      assert.deepStrictEqual(
        hindiKeys.sort(),
        ['hindiTemplate', 'infantMilkTemplate', 'overdueTemplate', 'outForDeliveryTemplate'].sort()
      );

      const englishKeys = englishDefs.map((d) => d.key);
      assert.deepStrictEqual(
        englishKeys.sort(),
        ['englishTemplate', 'englishInfantMilkTemplate', 'englishOverdueTemplate', 'englishOutForDeliveryTemplate'].sort()
      );
    });

    await auditTest('WhatsApp Language', '3.2 Verify English templates contain ZERO Hindi/Devanagari characters', () => {
      const devanagariRegex = /[\u0900-\u097F]/;

      const englishTemplatesToCheck: TemplateKey[] = [
        'englishTemplate',
        'englishInfantMilkTemplate',
        'englishOverdueTemplate',
        'englishOutForDeliveryTemplate',
      ];

      for (const key of englishTemplatesToCheck) {
        const text = DEFAULT_TEMPLATES[key];
        assert.ok(text, `Template ${key} must exist in DEFAULT_TEMPLATES`);
        const hasDevanagari = devanagariRegex.test(text);
        assert.strictEqual(
          hasDevanagari,
          false,
          `English template '${key}' contains forbidden Devanagari characters: "${text.match(devanagariRegex)?.[0]}"`
        );
      }
    });

    await auditTest('WhatsApp Language', '3.3 Verify English previews do NOT duplicate Hindi and English together', () => {
      const englishDefs = TEMPLATE_DEFINITIONS.filter((d) => d.language === 'english');
      const devanagariRegex = /[\u0900-\u097F]/;

      for (const def of englishDefs) {
        const template = DEFAULT_TEMPLATES[def.key];
        const rendered = renderTemplate(template, def.sampleVars);

        // Assert no Hindi text in English preview
        assert.strictEqual(
          devanagariRegex.test(rendered),
          false,
          `English preview for '${def.key}' contains Hindi text!`
        );

        // Assert English greeting/content exists
        assert.ok(
          rendered.includes('Dear') || rendered.includes('URGENT: Dear') || rendered.includes('order'),
          `Rendered English template '${def.key}' must contain English keywords`
        );
      }
    });

    await auditTest('WhatsApp Language', '3.4 Verify template rendering with customer name, medicine list, and UPI payment link', () => {
      const template =
        'Dear {{name}}, your prescription for {{medicine}} is ready. Total payable: ₹{{amount}}.\n' +
        'Pay instantly via UPI: {{upiLink}}\n' +
        '- {{pharmacy}}, Ph: {{phone}}';

      const customerName = 'Rajesh Sharma';
      const medicineList = 'Telma 40mg (Strip of 15), Glycomet-GP 1mg (Strip of 15)';
      const upiLink = 'upi://pay?pa=manojmedical@okhdfcbank&pn=Manoj%20Medical%20Hall&am=340&cu=INR&tn=Refill-102';

      const rendered = renderTemplate(template, {
        name: customerName,
        medicine: medicineList,
        amount: 340,
        upiLink: upiLink,
        pharmacy: 'Manoj Medical Hall',
        phone: '9431422744',
      });

      assert.ok(rendered.includes('Dear Rajesh Sharma'), 'Rendered text must contain customer name');
      assert.ok(
        rendered.includes('Telma 40mg (Strip of 15), Glycomet-GP 1mg (Strip of 15)'),
        'Rendered text must contain medicine list'
      );
      assert.ok(rendered.includes(upiLink), 'Rendered text must contain complete UPI payment link');
      assert.ok(rendered.includes('₹340'), 'Rendered text must contain amount');
      assert.ok(rendered.includes('9431422744'), 'Rendered text must contain pharmacy phone');
    });

    await auditTest('WhatsApp Language', '3.5 Verify generateWhatsAppBillText formats customer, medicines & UPI link', () => {
      const bill = {
        invoiceNo: 'MMH-26-00101',
        date: '08/09/2026',
        customerName: 'Amit Kumar',
        customerVillage: 'Sarfuddinpur',
        doctorName: 'Dr. R.K. Mishra',
        items: [
          {
            name: 'Telma 40mg',
            quantity: 2,
            effectiveRate: 90,
            grossTotal: 180,
            discountPercent: 10,
            discountAmount: 18,
            netTotal: 162,
          },
          {
            name: 'Glycomet 500mg',
            quantity: 3,
            effectiveRate: 50,
            grossTotal: 150,
            discountPercent: 10,
            discountAmount: 15,
            netTotal: 135,
          },
        ],
        grossAmount: 330,
        totalDiscount: 33,
        savingsPercent: 10,
        netPayable: 297,
        paymentMode: 'upi' as const,
      };

      const pharmacy = {
        name: 'Manoj Medical Hall',
        address: 'Sarfuddinpur, Muzaffarpur',
        phone: '9431422744',
        upiId: 'manojmedical.retail@okaxis',
        upiPayeeName: 'Manoj Medical Hall',
      };

      const billText = generateWhatsAppBillText(bill, pharmacy);

      assert.ok(billText.includes('Amit Kumar (Sarfuddinpur)'), 'Bill text contains customer name & village');
      assert.ok(billText.includes('1. *Telma 40mg*'), 'Bill text contains medicine 1');
      assert.ok(billText.includes('2. *Glycomet 500mg*'), 'Bill text contains medicine 2');
      assert.ok(billText.includes('upi://pay?pa=manojmedical.retail%40okaxis'), 'Bill text contains dynamic UPI link with updated VPA');
      assert.ok(billText.includes('NET AMOUNT PAYABLE: ₹297'), 'Bill text contains exact net payable');
    });

    // =========================================================================
    // SECTION 4: Layout & Navigation
    // =========================================================================
    console.log('\n\x1b[36m▶ 4. Layout & Navigation (src/components/layout.tsx)\x1b[0m');

    const layoutPath = path.resolve(__dirname, '../src/components/layout.tsx');
    const layoutSource = fs.readFileSync(layoutPath, 'utf-8');

    await auditTest('Layout Navigation', "4.1 Verify 'Import Data' has been REMOVED from the main sidebar navigation", () => {
      // 1. Ensure no href '/import' in sidebar
      assert.strictEqual(
        layoutSource.includes("href: '/import'"),
        false,
        "Main sidebar navigation must NOT contain href: '/import'"
      );
      // 2. Ensure no item named 'Import Data' or 'Import MARG' in navItems
      assert.strictEqual(
        layoutSource.includes("name: 'Import Data'"),
        false,
        "Main sidebar navigation must NOT contain 'Import Data'"
      );
      assert.strictEqual(
        layoutSource.includes("name: 'Import'"),
        false,
        "Main sidebar navigation must NOT contain 'Import'"
      );
    });

    await auditTest('Layout Navigation', "4.2 Verify 'Import Data' is cleanly accessible from Settings (/settings)", () => {
      const settingsPath = path.resolve(__dirname, '../src/app/settings/page.tsx');
      const settingsSource = fs.readFileSync(settingsPath, 'utf-8');

      // Verify tab exists
      assert.ok(
        settingsSource.includes("{ key: 'import', label: 'Import MARG Data', icon: Upload, badge: 'Excel / CSV' }"),
        "Settings page must contain tab: { key: 'import', label: 'Import MARG Data' }"
      );

      // Verify tab param handling (e.g. /settings?tab=import)
      assert.ok(
        settingsSource.includes("params.get('tab') as TabKey"),
        "Settings page parses '?tab=' query parameter for direct tab linking"
      );

      // Verify MARG Data Synchronization UI
      assert.ok(
        settingsSource.includes("MARG ERP Data Synchronization"),
        "Settings page houses complete MARG Data Synchronization UI"
      );
    });

    await auditTest('Layout Navigation', '4.3 Verify all required sidebar navigation links are present with exact paths', () => {
      const requiredLinks: { name: string; href: string }[] = [
        { name: 'Dashboard', href: '/' },
        { name: 'Retail Billing', href: '/billing' },
        { name: 'Customers', href: '/customers' },
        { name: 'Medicines', href: '/medicines' },
        { name: 'Prescriptions', href: '/prescriptions' },
        { name: 'Refills', href: '/refills' },
        { name: 'Daily Delivery PDF', href: '/delivery-sheet' },
        { name: 'Settings', href: '/settings' },
      ];

      for (const link of requiredLinks) {
        const hrefSnippet = `href: '${link.href}'`;
        assert.ok(
          layoutSource.includes(hrefSnippet),
          `Sidebar navItems missing required route: ${link.name} (${link.href})`
        );
      }
    });

  } finally {
    // =========================================================================
    // RESTORE DATABASE
    // =========================================================================
    console.log('\n\x1b[35m▶ Restoring original database settings...\x1b[0m');
    await db.pharmacySetting.deleteMany({});
    if (originalSettingsRows.length > 0) {
      await db.pharmacySetting.createMany({
        data: originalSettingsRows.map((r) => ({
          key: r.key,
          value: r.value,
        })),
      });
    }
    console.log(`  ✔ Restored ${originalSettingsRows.length} original pharmacySetting rows.`);
  }

  // =========================================================================
  // AUDIT SUMMARY
  // =========================================================================
  const totalPassed = auditLog.filter((t) => t.passed).length;
  const totalFailed = auditLog.filter((t) => !t.passed).length;
  const totalDuration = auditLog.reduce((sum, t) => sum + t.durationMs, 0);

  console.log('\n======================================================================');
  console.log(`  AUDIT RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED (${totalDuration}ms total)`);
  console.log('======================================================================\n');

  if (totalFailed > 0) {
    console.error(`\x1b[31m✖ Audit failed with ${totalFailed} errors!\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m✔ ALL ${totalPassed} AUDIT VERIFICATIONS PASSED WITH 100% COMPLIANCE!\x1b[0m\n`);
    process.exit(0);
  }
}

runAudit().catch((err) => {
  console.error('Fatal crash in audit runner:', err);
  process.exit(1);
});
