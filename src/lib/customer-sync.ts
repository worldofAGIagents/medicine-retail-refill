import { isSyrupMedicine, calculateRefill } from './refill-engine';

export interface PrescriptionWithMedicine {
  id: string;
  dailyDosage: number;
  nextRefillDate: string | null;
  lastPurchaseDate?: string | null;
  lastPurchaseQty?: number | null;
  customPackaging?: string | null;
  unitType?: string | null;
  bufferDays?: number;
  doctorName?: string | null;
  medicine: {
    id?: string;
    name: string;
    category: string;
    genericName?: string;
    packagingType?: string;
    unitsPerPack?: number;
    mrp?: number;
    currentStock?: number;
  };
}

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  altPhone?: string | null;
  address?: string | null;
  locality?: string | null;
  city?: string | null;
  primaryCondition?: string | null;
  whatsappEnabled?: boolean;
  consentGiven?: boolean;
  createdAt?: string;
  updatedAt?: string;
  prescriptions?: PrescriptionWithMedicine[];
}

export interface RefillRecordItem {
  id: string;
  dailyDosage: number;
  lastPurchaseDate: string;
  lastPurchaseQty: number;
  nextRefillDate: string;
  customPackaging?: string | null;
  unitType?: string | null;
  isSyrup?: boolean;
  customer: {
    id: string;
    name: string;
    phone: string;
    altPhone?: string | null;
    address?: string | null;
    locality?: string | null;
    city?: string | null;
  };
  medicine: {
    id: string;
    name: string;
    genericName?: string;
    category: string;
    unitsPerPack?: number;
    currentStock?: number;
    mrp?: number;
    packagingType?: string;
  };
  refillCalc: {
    daysRemaining: number;
    urgency: 'overdue' | 'urgent' | 'due_soon' | 'ok' | 'future';
    nextRefillDate: string;
  };
}

export const LOCAL_CUSTOMERS_KEY = 'manoj_local_customers';
export const CUSTOMERS_UPDATED_EVENT = 'manoj_customers_updated';

/**
 * Standardize any phone number to clean 10 digits
 */
export function clean10DigitPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return String(phone).replace(/[^0-9]/g, '').slice(-10);
}

/**
 * Sanitize a single customer record to guarantee zero duplicate prescriptions
 */
export function sanitizeCustomer(c: CustomerRecord): CustomerRecord {
  const seenMeds = new Set<string>();
  const cleanPrescriptions = (c.prescriptions || []).filter((p) => {
    const medKey = (
      p.medicine?.name ||
      (p.medicine as any)?.id ||
      p.medicine?.genericName ||
      p.id ||
      ''
    ).trim().toLowerCase();
    if (!medKey || seenMeds.has(medKey)) return false;
    seenMeds.add(medKey);
    return true;
  });

  return {
    ...c,
    phone: clean10DigitPhone(c.phone),
    altPhone: c.altPhone ? clean10DigitPhone(c.altPhone) : null,
    prescriptions: cleanPrescriptions,
  };
}

/**
 * Safely load all local customers from browser localStorage
 */
export function getLocalCustomers(): CustomerRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_CUSTOMERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeCustomer);
  } catch (err) {
    console.warn('Failed to read local customers from storage:', err);
    return [];
  }
}

export interface SaveCustomerOptions {
  source?: 'user_action' | 'server_sync' | 'storage_event';
  broadcast?: boolean;
}

/**
 * Save customers list to localStorage and broadcast event across components/tabs
 * Guarded against no-op writes and infinite loop echoes
 */
export function saveLocalCustomers(
  customers: CustomerRecord[],
  options: SaveCustomerOptions = { source: 'user_action', broadcast: true }
): void {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = customers.map(sanitizeCustomer);
    const newJson = JSON.stringify(sanitized);
    const currentJson = localStorage.getItem(LOCAL_CUSTOMERS_KEY);

    // LOOP GUARD: Skip write and event if payload is 100% identical
    if (currentJson === newJson) {
      return;
    }

    localStorage.setItem(LOCAL_CUSTOMERS_KEY, newJson);

    // Only broadcast if explicitly permitted (defaults to true for user actions)
    if (options.broadcast !== false) {
      window.dispatchEvent(
        new CustomEvent(CUSTOMERS_UPDATED_EVENT, {
          detail: { customers: sanitized, source: options.source || 'user_action' },
        })
      );
    }
  } catch (err) {
    console.warn('Failed to save local customers to storage:', err);
  }
}

/**
 * Upsert a single customer into localStorage without dropping existing prescriptions
 */
export function upsertLocalCustomer(customer: CustomerRecord): CustomerRecord[] {
  const current = getLocalCustomers();
  const targetPhone = clean10DigitPhone(customer.phone);

  const existingIndex = current.findIndex((c) => clean10DigitPhone(c.phone) === targetPhone);

  let updatedList: CustomerRecord[];
  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    // Merge prescriptions: prefer new prescriptions, retain existing if new has none
    const existingPrescriptions = existing.prescriptions || [];
    const newPrescriptions = customer.prescriptions || [];
    const mergedPrescriptions =
      newPrescriptions.length > 0 ? newPrescriptions : existingPrescriptions;

    const mergedRecord: CustomerRecord = {
      ...existing,
      ...customer,
      id: customer.id || existing.id,
      name: customer.name || existing.name,
      phone: targetPhone,
      address: customer.address || existing.address,
      locality: customer.locality || existing.locality,
      primaryCondition: customer.primaryCondition || existing.primaryCondition,
      prescriptions: mergedPrescriptions,
      updatedAt: new Date().toISOString(),
    };

    updatedList = [...current];
    updatedList[existingIndex] = sanitizeCustomer(mergedRecord);
  } else {
    const newRecord: CustomerRecord = {
      ...customer,
      id: customer.id || `local-${Date.now()}`,
      phone: targetPhone,
      createdAt: customer.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updatedList = [sanitizeCustomer(newRecord), ...current];
  }

  saveLocalCustomers(updatedList);
  return updatedList;
}

/**
 * Merge authoritative server list and client local list:
 * 1. Matches by clean 10-digit phone.
 * 2. Never drops prescriptions if server record has fewer prescriptions than local record.
 * 3. Keeps local-only patients that the server hasn't saved yet.
 * 4. Auto-reseeds server asynchronously if any local patient is missing on server.
 */
// In-flight reseed cache to prevent duplicate POST storms
const inFlightReseedSet = new Set<string>();

export function mergeCustomerLists(
  serverList: CustomerRecord[],
  localList: CustomerRecord[],
  reseedMissingToServer: boolean = true
): CustomerRecord[] {
  const cleanServer = (serverList || []).map(sanitizeCustomer);
  const cleanLocal = (localList || []).map(sanitizeCustomer);

  const serverPhoneMap = new Map<string, CustomerRecord>();
  cleanServer.forEach((sc) => {
    const p = clean10DigitPhone(sc.phone);
    if (p) serverPhoneMap.set(p, sc);
  });

  const mergedMap = new Map<string, CustomerRecord>();

  // 1. Start with server records
  cleanServer.forEach((sc) => {
    const p = clean10DigitPhone(sc.phone);
    if (p) mergedMap.set(p, sc);
  });

  // 2. Merge local records: protect richer local data
  cleanLocal.forEach((lc) => {
    const p = clean10DigitPhone(lc.phone);
    if (!p) return;

    if (mergedMap.has(p)) {
      const serverRec = mergedMap.get(p)!;
      const sRx = serverRec.prescriptions || [];
      const lRx = lc.prescriptions || [];

      // If local has prescriptions and server has none or fewer, preserve local prescriptions
      const bestPrescriptions = lRx.length >= sRx.length ? lRx : sRx;

      mergedMap.set(p, {
        ...serverRec,
        ...lc,
        id: serverRec.id || lc.id, // prefer persistent server ID
        name: lc.name || serverRec.name,
        phone: p,
        address: lc.address || serverRec.address,
        locality: lc.locality || serverRec.locality,
        primaryCondition: lc.primaryCondition || serverRec.primaryCondition,
        prescriptions: bestPrescriptions,
        updatedAt: (lc as any).updatedAt || (serverRec as any).updatedAt || new Date().toISOString(),
      });
    } else {
      // Local patient completely missing on server
      mergedMap.set(p, lc);
    }
  });

  // 3. CANONICAL DETERMINISTIC SORT:
  // Sort by updatedAt/createdAt desc -> Name asc -> Phone/ID
  const finalMerged = Array.from(mergedMap.values())
    .map(sanitizeCustomer)
    .sort((a, b) => {
      const aTime = new Date((a as any).updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date((b as any).updatedAt || b.createdAt || 0).getTime();
      if (bTime !== aTime) return bTime - aTime;
      const nameDiff = (a.name || '').localeCompare(b.name || '', 'hi-IN', { sensitivity: 'base' });
      if (nameDiff !== 0) return nameDiff;
      return (a.phone || a.id || '').localeCompare(b.phone || b.id || '');
    });

  // 4. Auto-reseed server if enabled and running in browser
  if (reseedMissingToServer && typeof window !== 'undefined') {
    const missingOnServer = cleanLocal.filter((lc) => {
      const p = clean10DigitPhone(lc.phone);
      return p && !serverPhoneMap.has(p) && !inFlightReseedSet.has(p);
    });

    if (missingOnServer.length > 0) {
      missingOnServer.forEach((mc) => {
        const p = clean10DigitPhone(mc.phone);
        inFlightReseedSet.add(p);

        const cleanMeds = (mc.prescriptions || []).map((pr) => ({
          medicineId: (pr.medicine as any)?.id,
          category: pr.medicine?.category || mc.primaryCondition,
          dailyDosage: pr.dailyDosage || 1,
          lastPurchaseQty: pr.lastPurchaseQty || 30,
          customPackaging: pr.customPackaging,
          unitType: pr.unitType || 'tablets',
          customMrp: pr.medicine?.mrp,
        }));

        fetch('/api/customers/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: mc.name,
            phone: p,
            altPhone: mc.altPhone ? clean10DigitPhone(mc.altPhone) : undefined,
            address: mc.address || `गाँव: ${mc.locality || 'Sarfuddinpur'}`,
            locality: mc.locality || 'Sarfuddinpur',
            city: mc.city || 'Muzaffarpur',
            primaryCondition: mc.primaryCondition || 'Blood Pressure',
            medicines: cleanMeds,
          }),
        })
          .catch((err) => {
            console.warn('Customer auto-reseed warning:', err);
            inFlightReseedSet.delete(p);
          });
      });
    }
  }

  return finalMerged;
}

/**
 * Generate refill items from a customer's prescriptions
 */
export function buildCustomerRefills(cust: CustomerRecord): RefillRecordItem[] {
  const items: RefillRecordItem[] = [];
  const cleanPhone = clean10DigitPhone(cust.phone);

  (cust.prescriptions || []).forEach((p, idx) => {
    if (!p.medicine?.name) return;

    const isSyrup = isSyrupMedicine({
      name: p.medicine.name,
      genericName: p.medicine.genericName,
      category: p.medicine.category,
      packagingType: p.medicine.packagingType,
      unitType: p.unitType,
      customPackaging: p.customPackaging,
    });

    const purchaseDate = p.lastPurchaseDate ? new Date(p.lastPurchaseDate) : new Date();
    const qty = Number(p.lastPurchaseQty) || 30;
    const dose = Number(p.dailyDosage) || 1;
    const buffer = Number(p.bufferDays) || 3;

    const refillCalc = calculateRefill({
      lastPurchaseDate: purchaseDate,
      lastPurchaseQty: qty,
      dailyDosage: dose,
      bufferDays: buffer,
      medicineName: p.medicine.name,
      genericName: p.medicine.genericName,
      category: p.medicine.category,
      packagingType: p.medicine.packagingType,
      unitType: p.unitType || undefined,
      customPackaging: p.customPackaging || undefined,
    });

    const refillDateStr = p.nextRefillDate || refillCalc.nextRefillDate.toISOString();
    const diffDays = isSyrup
      ? 1
      : Math.ceil((new Date(refillDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    let urgency: 'overdue' | 'urgent' | 'due_soon' | 'ok' | 'future' = 'ok';
    if (diffDays <= 0) urgency = 'overdue';
    else if (diffDays <= 2) urgency = 'urgent';
    else if (diffDays <= 5) urgency = 'due_soon';
    else if (diffDays <= 10) urgency = 'ok';
    else urgency = 'future';

    items.push({
      id: p.id || `local-refill-${cust.id}-${idx}`,
      dailyDosage: dose,
      lastPurchaseDate: purchaseDate.toISOString(),
      lastPurchaseQty: qty,
      nextRefillDate: refillDateStr,
      customPackaging: p.customPackaging,
      unitType: p.unitType || 'tablets',
      isSyrup,
      customer: {
        id: cust.id,
        name: cust.name,
        phone: cleanPhone,
        altPhone: cust.altPhone,
        address: cust.address,
        locality: cust.locality,
        city: cust.city,
      },
      medicine: {
        id: p.medicine.id || `med-${idx}`,
        name: p.medicine.name,
        genericName: p.medicine.genericName,
        category: p.medicine.category || 'Chronic',
        unitsPerPack: p.medicine.unitsPerPack || 10,
        currentStock: p.medicine.currentStock || 50,
        mrp: p.medicine.mrp || 0,
        packagingType: p.medicine.packagingType,
      },
      refillCalc: {
        daysRemaining: diffDays,
        urgency,
        nextRefillDate: refillDateStr,
      },
    });
  });

  return items;
}

/**
 * Universal refill merger: combines server refills with all local customer prescriptions
 * Guarantees zero duplicate refill rows per customer + medicine
 */
export function mergeRefillLists(
  serverRefills: RefillRecordItem[],
  localCustomers: CustomerRecord[]
): RefillRecordItem[] {
  const merged: RefillRecordItem[] = [...(serverRefills || [])];
  const seenKeys = new Set<string>();

  // Mark all server refills
  merged.forEach((item) => {
    const cPhone = clean10DigitPhone(item.customer?.phone);
    const mName = (item.medicine?.name || '').trim().toLowerCase();
    if (cPhone && mName) {
      seenKeys.add(`${cPhone}::${mName}`);
    }
  });

  // Extract refills from all local customers
  localCustomers.forEach((cust) => {
    const clientRefills = buildCustomerRefills(cust);
    clientRefills.forEach((cr) => {
      const cPhone = clean10DigitPhone(cr.customer.phone);
      const mName = (cr.medicine.name || '').trim().toLowerCase();
      const key = `${cPhone}::${mName}`;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        merged.push(cr);
      }
    });
  });

  // DETERMINISTIC MULTI-TIER STABLE SORT
  return merged.sort((a, b) => {
    // 1. Urgency / daysRemaining ascending (most urgent first)
    if (a.refillCalc.daysRemaining !== b.refillCalc.daysRemaining) {
      return a.refillCalc.daysRemaining - b.refillCalc.daysRemaining;
    }
    // 2. Next refill date timestamp
    const aDate = new Date(a.nextRefillDate || a.refillCalc.nextRefillDate).getTime() || 0;
    const bDate = new Date(b.nextRefillDate || b.refillCalc.nextRefillDate).getTime() || 0;
    if (aDate !== bDate) return aDate - bDate;

    // 3. Customer name alphabetical
    const custDiff = (a.customer?.name || '').localeCompare(b.customer?.name || '', 'hi-IN', { sensitivity: 'base' });
    if (custDiff !== 0) return custDiff;

    // 4. Medicine name alphabetical
    const medDiff = (a.medicine?.name || '').localeCompare(b.medicine?.name || '', 'hi-IN', { sensitivity: 'base' });
    if (medDiff !== 0) return medDiff;

    // 5. Unique Item ID tie-breaker
    return (a.id || '').localeCompare(b.id || '');
  });
}
