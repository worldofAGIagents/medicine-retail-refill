'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X, UserPlus, Phone, MapPin, Search, CheckCircle2,
  AlertCircle, Pill, Calendar, Clock, Heart, Sparkles, Plus, Minus, Trash2, Layers, RotateCcw
} from 'lucide-react';
import {
  detectMedicineCategory,
  CHRONIC_CONDITIONS_LIST,
  DEFAULT_CHRONIC_CATEGORY,
  normalizeChronicCategory
} from '@/lib/medicine-classifier';
import { isSyrupMedicine } from '@/lib/refill-engine';
import { clean10DigitPhone, upsertLocalCustomer } from '@/lib/customer-sync';

interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  unitsPerPack: number;
  packagingType: string;
  mrp: number;
  manufacturer?: string;
  margItemCode?: string;
}

export interface PrescribedMedicineItem {
  medicine: Medicine;
  category?: string;
  unitMode: 'strips' | 'tablets' | 'tins';
  stripCount: number;
  totalQty: number;
  dailyDosage: number;
  bufferDays: number;
  customMrp?: number;
  customUnitsPerPack?: number;
}

interface OnboardPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CONDITIONS = CHRONIC_CONDITIONS_LIST;

export const LOCAL_VILLAGES = [
  'Sarfuddinpur',
  'Gopalpur',
  'Bochahan',
  'Gaighat',
  'Ladaura',
  'Musahari',
  'Sahila',
  'Etwarpur',
  'Madhurapur',
  'Majhauli',
  'Athar',
];

export function OnboardPatientModal({ isOpen, onClose, onSuccess }: OnboardPatientModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('Sarfuddinpur');
  const [landmark, setLandmark] = useState('');
  const [altPhone, setAltPhone] = useState('');
  // Default to Blood Pressure (BP) as required
  const [condition, setCondition] = useState<string>('Blood Pressure');
  const [conditionManuallySelected, setConditionManuallySelected] = useState(false);

  // Multi-Medicine Prescriptions List
  const [prescribedMeds, setPrescribedMeds] = useState<PrescribedMedicineItem[]>([]);

  // Search State for adding medicines
  const [medSearch, setMedSearch] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medDropdownOpen, setMedDropdownOpen] = useState(false);
  const [medLoading, setMedLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const medRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (medRef.current && !medRef.current.contains(e.target as Node)) {
        setMedDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search medicines from live catalog (with prefix-first ranking)
  const searchMedicines = (q: string) => {
    setMedLoading(true);
    const params = new URLSearchParams({ limit: '30' });
    if (q.trim()) params.set('q', q.trim());

    fetch(`/api/medicines?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.data || []);
        setMedicines(list);
        setMedLoading(false);
      })
      .catch(() => setMedLoading(false));
  };

  const handleMedSearchChange = (val: string) => {
    setMedSearch(val);
    setMedDropdownOpen(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchMedicines(val);
    }, 200);
  };

  // Add medicine to the prescribed list
  const handleAddMedicine = (med: Medicine) => {
    // Avoid duplicate additions
    if (prescribedMeds.some((p) => p.medicine.id === med.id)) {
      setMedDropdownOpen(false);
      setMedSearch('');
      return;
    }

    // Dynamic category detection with Blood Pressure (BP) fallback
    const detectedCat = (med.category && med.category !== 'General' && med.category !== 'Uncategorized')
      ? med.category
      : detectMedicineCategory(med.name, med.genericName, (med as any).saltComposition);

    const finalItemCategory = detectedCat || DEFAULT_CHRONIC_CATEGORY;

    // Dynamically learn / sync patient condition if user hasn't manually locked it
    if (!conditionManuallySelected && finalItemCategory) {
      setCondition(finalItemCategory);
    }

    const isInfant = finalItemCategory === 'Infant Milk' || med.category === 'Infant Milk' || med.packagingType === 'tin';
    const packUnits = med.unitsPerPack > 0 ? med.unitsPerPack : 10;

    let newItem: PrescribedMedicineItem;
    if (isInfant) {
      newItem = {
        medicine: med,
        category: finalItemCategory,
        unitMode: 'tins',
        stripCount: 1,
        totalQty: packUnits || 400,
        dailyDosage: 40, // 40 grams / day default
        bufferDays: 2,
        customMrp: med.mrp,
        customUnitsPerPack: packUnits || 400,
      };
    } else {
      const defaultStrips = 2; // e.g. 2 strips default
      newItem = {
        medicine: med,
        category: finalItemCategory,
        unitMode: 'strips',
        stripCount: defaultStrips,
        totalQty: defaultStrips * packUnits,
        dailyDosage: 1, // 1 tablet / day default
        bufferDays: 3,
        customMrp: med.mrp,
        customUnitsPerPack: packUnits,
      };
    }

    setPrescribedMeds((prev) => [...prev, newItem]);
    setMedSearch('');
    setMedDropdownOpen(false);
  };

  const handleRemoveMedicine = (index: number) => {
    setPrescribedMeds((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateMedicine = (index: number, updates: Partial<PrescribedMedicineItem>) => {
    setPrescribedMeds((prev) => {
      const updated = [...prev];
      const current = updated[index];
      const merged = { ...current, ...updates };

      const packUnits = (merged.customUnitsPerPack && merged.customUnitsPerPack > 0)
        ? merged.customUnitsPerPack
        : (current.medicine.unitsPerPack > 0 ? current.medicine.unitsPerPack : 10);

      // If stripCount or customUnitsPerPack changed in strips mode, recalculate totalQty
      if ((updates.stripCount !== undefined || updates.customUnitsPerPack !== undefined) && merged.unitMode === 'strips') {
        const count = merged.stripCount > 0 ? merged.stripCount : 1;
        merged.totalQty = count * packUnits;
      }

      // If unitMode switched to strips, recalculate totalQty from stripCount
      if (updates.unitMode === 'strips') {
        merged.stripCount = merged.stripCount > 0 ? merged.stripCount : 1;
        merged.totalQty = merged.stripCount * packUnits;
      }

      if ((updates.stripCount !== undefined || updates.customUnitsPerPack !== undefined) && merged.unitMode === 'tins') {
        const count = merged.stripCount > 0 ? merged.stripCount : 1;
        merged.totalQty = count * packUnits;
      }

      updated[index] = merged;
      return updated;
    });
  };

  // Compute refill dates preview for an item
  const getRefillPreview = (item: PrescribedMedicineItem) => {
    const isSyrup = isSyrupMedicine({
      name: item.medicine.name,
      genericName: item.medicine.genericName,
      category: item.category || item.medicine.category,
      packagingType: item.medicine.packagingType,
      unitType: item.unitMode === 'tins' ? 'grams' : item.unitMode === 'strips' ? 'strips' : 'tablets',
    });

    if (isSyrup) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
      return {
        supplyDays: 1,
        isSyrup: true,
        refillDateStr: 'Tomorrow (Next Day)',
        targetDateIso: targetDate.toISOString(),
      };
    }

    const supplyDays = item.dailyDosage > 0 ? Math.floor(item.totalQty / item.dailyDosage) : 0;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + Math.max(1, supplyDays - item.bufferDays));
    return {
      supplyDays,
      isSyrup: false,
      refillDateStr: targetDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      targetDateIso: targetDate.toISOString(),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim()) {
      setErrorMsg('Patient full name is required');
      return;
    }

    const cleanPhone = clean10DigitPhone(phone);
    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }

    const cleanAlt = clean10DigitPhone(altPhone);

    setSaving(true);
    try {
      const villageAddress = `गाँव: ${village.trim()}${landmark.trim() ? ', ' + landmark.trim() : ''}`;

      // Deduplicate prescribed medicines to guarantee zero duplicate prescriptions
      const seenMedIds = new Set<string>();
      const dedupedMeds = prescribedMeds.filter((item) => {
        const key = (item.medicine.name || item.medicine.id).trim().toLowerCase();
        if (seenMedIds.has(key)) return false;
        seenMedIds.add(key);
        return true;
      });

      const effectiveCondition = condition || DEFAULT_CHRONIC_CATEGORY;

      const payload = {
        name: name.trim(),
        phone: cleanPhone,
        altPhone: cleanAlt || undefined,
        address: villageAddress,
        locality: village.trim(),
        city: 'Muzaffarpur',
        primaryCondition: effectiveCondition,
        medicines: dedupedMeds.map((item) => {
          const packUnits = (item.customUnitsPerPack && item.customUnitsPerPack > 0)
            ? item.customUnitsPerPack
            : (item.medicine.unitsPerPack > 0 ? item.medicine.unitsPerPack : 10);
          let packagingDesc = '';
          if (item.unitMode === 'strips') {
            packagingDesc = `${item.stripCount} Strip(s) (${packUnits} tabs/strip)`;
          } else if (item.unitMode === 'tins') {
            packagingDesc = `${item.stripCount} Tin(s) (${packUnits}g)`;
          } else {
            packagingDesc = `${item.totalQty} Tablets`;
          }

          return {
            medicineId: item.medicine.id,
            category: item.category || effectiveCondition,
            dailyDosage: Number(item.dailyDosage) || 1,
            lastPurchaseQty: Number(item.totalQty) || 30,
            lastPurchaseDate: new Date().toISOString(),
            bufferDays: Number(item.bufferDays) || 3,
            customPackaging: packagingDesc,
            unitType: item.unitMode === 'tins' ? 'grams' : 'tablets',
            customMrp: item.customMrp && Number(item.customMrp) > 0 ? Number(item.customMrp) : item.medicine.mrp,
            customUnitsPerPack: packUnits,
          };
        }),
      };

      // 1. FAIL-SAFE LOCAL STORAGE PERSISTENCE (Guarantees zero data loss even during server sleep/redeploy)
      const newRecord = {
        id: `local-${Date.now()}`,
        name: name.trim(),
        phone: cleanPhone,
        altPhone: cleanAlt || undefined,
        address: villageAddress,
        locality: village.trim(),
        city: 'Muzaffarpur',
        primaryCondition: effectiveCondition,
        whatsappEnabled: true,
        createdAt: new Date().toISOString(),
        prescriptions: dedupedMeds.map((item, pIdx) => {
          const packUnits = item.customUnitsPerPack || item.medicine.unitsPerPack || 10;
          const preview = getRefillPreview(item);
          return {
            id: `rx-${Date.now()}-${pIdx}`,
            dailyDosage: Number(item.dailyDosage) || 1,
            lastPurchaseQty: Number(item.totalQty) || 30,
            nextRefillDate: preview.targetDateIso || preview.refillDateStr,
            customPackaging: preview.isSyrup
              ? '1 Bottle (Syrup)'
              : item.unitMode === 'tins'
              ? `${packUnits}g Tin`
              : `${item.stripCount} Strip(s) (${packUnits} tabs/strip)`,
            medicine: {
              ...item.medicine,
              category: item.category || (preview.isSyrup ? 'Syrup' : effectiveCondition),
              mrp: item.customMrp || item.medicine.mrp,
              unitsPerPack: packUnits,
            },
          };
        }),
      };

      // Immediately upsert into localStorage and broadcast update event to all open screens
      upsertLocalCustomer(newRecord);

      // 2. Sync to server database in parallel
      try {
        const res = await fetch('/api/customers/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data?.customer?.id) {
          newRecord.id = data.customer.id;
          upsertLocalCustomer(newRecord);
        }
      } catch (netErr) {
        console.warn('Server sync will auto-retry on reload:', netErr);
      }

      setSuccessMsg(
        dedupedMeds.length > 0
          ? `Patient ${name} onboarded with ${dedupedMeds.length} medicine(s) successfully!`
          : `Patient ${name} registered successfully!`
      );
      setTimeout(() => {
        onSuccess?.();
        onClose();
        // Reset form
        setName('');
        setPhone('');
        setVillage('Sarfuddinpur');
        setLandmark('');
        setAltPhone('');
        setPrescribedMeds([]);
        setMedSearch('');
        setSuccessMsg('');
        setSaving(false);
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with server');
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-7 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto border border-gray-100">
        {/* Header */}
        <div className="flex justify-between items-start border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <UserPlus size={18} />
              </span>
              <h2 className="font-bold text-lg text-gray-900 font-heading">Onboard Patient for Auto-Refill</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Register customer, select chronic condition, and add repeat medicines with strip/tablet counts
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center gap-2 text-xs font-semibold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-xl flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 size={16} className="shrink-0 text-green-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Patient Details */}
          <div className="space-y-3 bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">1. Patient Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Patient Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Verma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">WhatsApp Mobile *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full pl-11 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Village & Landmark for 10-20 KM Delivery */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">गाँव / Village Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarfuddinpur, Gopalpur, Bochahan"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                />
                <div className="flex items-center gap-1 flex-wrap pt-1.5">
                  {LOCAL_VILLAGES.slice(0, 5).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVillage(v)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border transition-all ${
                        village === v
                          ? 'bg-teal-700 text-white border-teal-800'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">टोला / वार्ड / लैंडमार्क (Landmark)</label>
                <input
                  type="text"
                  placeholder="e.g. Ward 4, Near Shiv Mandir, Pulia"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Used by delivery boy to locate patient in village
                </p>
              </div>
            </div>

            {/* Alternate Family Contact */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                वैकल्पिक मोबाइल / Alternate Family Phone (बेटा/भाई/केयरटेकर) - Optional
              </label>
              <div className="relative max-w-sm">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="9876543210"
                  value={altPhone}
                  onChange={(e) => setAltPhone(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full pl-11 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Chronic Condition Selection (Optional • Auto-detects • BP Default) */}
          <div className="space-y-2 bg-gradient-to-r from-teal-50/40 via-blue-50/30 to-purple-50/20 p-3.5 rounded-2xl border border-teal-100/80">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Chronic Condition Category
                </label>
                <span className="text-[10px] font-semibold text-teal-700 bg-white px-2 py-0.5 rounded-md border border-teal-200">
                  Optional • Auto-detects • Defaults to BP
                </span>
              </div>
              {condition !== DEFAULT_CHRONIC_CATEGORY && (
                <button
                  type="button"
                  onClick={() => {
                    setCondition(DEFAULT_CHRONIC_CATEGORY);
                    setConditionManuallySelected(false);
                  }}
                  className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-teal-200 hover:bg-teal-50 transition-colors shadow-2xs"
                  title="Reset category back to default Blood Pressure"
                >
                  <RotateCcw size={12} /> Reset to BP (Default)
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              Select or change condition anytime. Clicking active button deselects and returns to <strong className="text-teal-800">Blood Pressure (BP)</strong>.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {CONDITIONS.map((c) => {
                const isSelected = condition === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        // Deselecting marks it back as BP (Blood Pressure)
                        setCondition(DEFAULT_CHRONIC_CATEGORY);
                        setConditionManuallySelected(false);
                      } else {
                        setCondition(c.id);
                        setConditionManuallySelected(true);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-teal-700 text-white border-teal-800 shadow-xs scale-102 font-bold'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                    }`}
                    title={isSelected ? 'Click to deselect (reverts to BP)' : `Select ${c.label}`}
                  >
                    <span>{c.label}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white inline-block" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer Medicines Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Customer Medicines ({prescribedMeds.length} added)
              </label>
              <span className="text-[11px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-md">
                Strips / Packs auto-converted
              </span>
            </div>

            {/* List of currently selected medicines */}
            {prescribedMeds.length > 0 && (
              <div className="space-y-3">
                {prescribedMeds.map((item, idx) => {
                  const packUnits = (item.customUnitsPerPack && item.customUnitsPerPack > 0)
                    ? item.customUnitsPerPack
                    : (item.medicine.unitsPerPack > 0 ? item.medicine.unitsPerPack : 10);
                  const effectiveMrp = item.customMrp !== undefined ? item.customMrp : item.medicine.mrp;
                  const { supplyDays, refillDateStr } = getRefillPreview(item);
                  const approxTotalCost = item.unitMode === 'strips' || item.unitMode === 'tins'
                    ? (effectiveMrp * (item.stripCount || 1))
                    : (effectiveMrp * (item.totalQty / packUnits));

                  return (
                    <div
                      key={item.medicine.id}
                      className="p-4 bg-gray-50/90 rounded-2xl border border-gray-200 space-y-3 relative transition-all hover:border-teal-300"
                    >
                      {/* Medicine Title & Remove Button */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <p className="font-bold text-gray-900 text-sm truncate">{item.medicine.name}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 mt-1 pl-7">
                            <span className="truncate max-w-[120px]">{item.medicine.manufacturer || 'Indian Pharma'}</span>
                            <span>•</span>
                            {/* Editable Packaging */}
                            <div className="flex items-center gap-1 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                              <label className="font-semibold text-teal-900 text-[10px] uppercase">Pack:</label>
                              <input
                                type="number"
                                min={1}
                                value={item.customUnitsPerPack ?? packUnits}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                  handleUpdateMedicine(idx, { customUnitsPerPack: isNaN(val) ? 0 : val });
                                }}
                                onBlur={() => {
                                  if (!item.customUnitsPerPack || item.customUnitsPerPack < 1) {
                                    handleUpdateMedicine(idx, { customUnitsPerPack: packUnits });
                                  }
                                }}
                                className="w-12 text-center text-xs font-bold text-teal-900 bg-white border border-teal-300 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-teal-500"
                                title="Edit packaging (e.g. change 10 to 15 tabs/strip)"
                              />
                              <span className="text-[10px] text-teal-800 font-medium">
                                {item.unitMode === 'tins' ? 'g/tin' : 'tabs/strip'}
                              </span>
                            </div>
                            <span>•</span>
                            {/* Editable MRP */}
                            <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              <label className="font-semibold text-amber-900 text-[10px] uppercase">MRP ₹</label>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={item.customMrp !== undefined ? item.customMrp : item.medicine.mrp}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                  handleUpdateMedicine(idx, { customMrp: isNaN(val) ? 0 : val });
                                }}
                                className="w-16 text-center text-xs font-bold text-amber-900 bg-white border border-amber-300 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-amber-500"
                                title="Edit medicine MRP"
                              />
                            </div>
                          </div>

                          {/* Individual Medicine Category Tag & Deselect Controls */}
                          <div className="flex items-center gap-1.5 mt-2 pl-7 flex-wrap">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                              Category:
                            </span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {CONDITIONS.map((cond) => {
                                const isSelected = (item.category || DEFAULT_CHRONIC_CATEGORY) === cond.id;
                                return (
                                  <button
                                    key={cond.id}
                                    type="button"
                                    onClick={() => {
                                      // If clicked while selected, deselect and mark as Blood Pressure (BP)
                                      const nextCat = isSelected ? DEFAULT_CHRONIC_CATEGORY : cond.id;
                                      handleUpdateMedicine(idx, { category: nextCat });
                                    }}
                                    className={`text-[10px] px-2 py-0.5 rounded-md font-semibold transition-all cursor-pointer border ${
                                      isSelected
                                        ? 'bg-teal-700 text-white border-teal-800 shadow-2xs'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                                    }`}
                                    title={isSelected ? 'Click to deselect (marks as BP)' : `Categorize as ${cond.label}`}
                                  >
                                    {cond.label}
                                    {isSelected && ' ✓'}
                                  </button>
                                );
                              })}
                              {item.category && item.category !== DEFAULT_CHRONIC_CATEGORY && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateMedicine(idx, { category: DEFAULT_CHRONIC_CATEGORY })}
                                  className="text-[10px] text-amber-700 hover:text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md font-semibold cursor-pointer"
                                  title="Deselect and reset this medicine to BP"
                                >
                                  Deselect (Reset to BP)
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveMedicine(idx)}
                          className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title="Remove Medicine"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Quantity & Dosage Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-200/80">
                        {/* Quantity Mode: Strips vs Loose Tablets */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-gray-700 uppercase">Quantity</label>
                            {item.unitMode !== 'tins' && (
                              <div className="flex items-center gap-1 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateMedicine(idx, { unitMode: 'strips' })}
                                  className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                                    item.unitMode === 'strips'
                                      ? 'bg-teal-700 text-white'
                                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                  }`}
                                >
                                  Strips
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateMedicine(idx, { unitMode: 'tablets' })}
                                  className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${
                                    item.unitMode === 'tablets'
                                      ? 'bg-teal-700 text-white'
                                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                  }`}
                                >
                                  Tabs
                                </button>
                              </div>
                            )}
                          </div>

                          {item.unitMode === 'strips' ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateMedicine(idx, { stripCount: Math.max(1, (item.stripCount || 1) - 1) })}
                                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 flex items-center justify-center font-bold transition-colors cursor-pointer border border-gray-200 shrink-0"
                                  title="Decrease strip count"
                                >
                                  <Minus size={14} />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  value={item.stripCount === 0 ? '' : item.stripCount}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                    handleUpdateMedicine(idx, { stripCount: isNaN(val) ? 0 : val });
                                  }}
                                  onBlur={() => {
                                    if (!item.stripCount || item.stripCount < 1) {
                                      handleUpdateMedicine(idx, { stripCount: 1 });
                                    }
                                  }}
                                  className="w-16 text-center px-2 py-1.5 text-sm font-bold bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateMedicine(idx, { stripCount: (item.stripCount || 1) + 1 })}
                                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 flex items-center justify-center font-bold transition-colors cursor-pointer border border-gray-200 shrink-0"
                                  title="Increase strip count"
                                >
                                  <Plus size={14} />
                                </button>
                                <span className="text-xs font-semibold text-gray-600">strip(s)</span>
                              </div>
                              <p className="text-[11px] text-teal-700 font-medium mt-1">
                                = <strong>{item.totalQty}</strong> tablets ({packUnits} tabs/strip)
                              </p>
                            </div>
                          ) : item.unitMode === 'tins' ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateMedicine(idx, { stripCount: Math.max(1, (item.stripCount || 1) - 1) })}
                                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 flex items-center justify-center font-bold transition-colors cursor-pointer border border-gray-200 shrink-0"
                                >
                                  <Minus size={14} />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  value={item.stripCount === 0 ? '' : item.stripCount}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                    handleUpdateMedicine(idx, { stripCount: isNaN(val) ? 0 : val });
                                  }}
                                  onBlur={() => {
                                    if (!item.stripCount || item.stripCount < 1) {
                                      handleUpdateMedicine(idx, { stripCount: 1 });
                                    }
                                  }}
                                  className="w-16 text-center px-2 py-1.5 text-sm font-bold bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateMedicine(idx, { stripCount: (item.stripCount || 1) + 1 })}
                                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 flex items-center justify-center font-bold transition-colors cursor-pointer border border-gray-200 shrink-0"
                                >
                                  <Plus size={14} />
                                </button>
                                <span className="text-xs font-semibold text-gray-600">tin(s)</span>
                              </div>
                              <p className="text-[11px] text-teal-700 font-medium mt-1">
                                = <strong>{item.totalQty}g</strong> powder total
                              </p>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateMedicine(idx, { totalQty: Math.max(1, (item.totalQty || 10) - 5) })}
                                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 flex items-center justify-center font-bold transition-colors cursor-pointer border border-gray-200 shrink-0"
                                >
                                  <Minus size={14} />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  value={item.totalQty === 0 ? '' : item.totalQty}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                                    handleUpdateMedicine(idx, { totalQty: isNaN(val) ? 0 : val });
                                  }}
                                  onBlur={() => {
                                    if (!item.totalQty || item.totalQty < 1) {
                                      handleUpdateMedicine(idx, { totalQty: 10 });
                                    }
                                  }}
                                  className="w-20 text-center px-2 py-1.5 text-sm font-bold bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateMedicine(idx, { totalQty: (item.totalQty || 0) + 5 })}
                                  className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 flex items-center justify-center font-bold transition-colors cursor-pointer border border-gray-200 shrink-0"
                                >
                                  <Plus size={14} />
                                </button>
                                <span className="text-xs font-semibold text-gray-600">tabs</span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-1">total loose tablets</p>
                            </div>
                          )}
                        </div>

                        {/* Daily Usage */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                            Daily Usage
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateMedicine(idx, { dailyDosage: Math.max(0.5, (item.dailyDosage || 1) - 0.5) })}
                              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 flex items-center justify-center font-bold transition-colors cursor-pointer border border-gray-200 shrink-0"
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              min={0.5}
                              step={0.5}
                              value={item.dailyDosage === 0 ? '' : item.dailyDosage}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                handleUpdateMedicine(idx, { dailyDosage: isNaN(val) ? 0 : val });
                              }}
                              onBlur={() => {
                                if (!item.dailyDosage || item.dailyDosage <= 0) {
                                  handleUpdateMedicine(idx, { dailyDosage: 1 });
                                }
                              }}
                              className="w-16 text-center px-2 py-1.5 text-sm font-bold bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateMedicine(idx, { dailyDosage: (item.dailyDosage || 1) + 0.5 })}
                              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 flex items-center justify-center font-bold transition-colors cursor-pointer border border-gray-200 shrink-0"
                            >
                              <Plus size={14} />
                            </button>
                            <span className="text-xs font-semibold text-gray-600">
                              {item.unitMode === 'tins' ? 'g/day' : 'tab/day'}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1">
                            {item.unitMode === 'tins' ? 'grams per day' : 'tablets per day'}
                          </p>
                        </div>

                        {/* Schedule & Refill Target */}
                        <div className="bg-white p-2 rounded-xl border border-gray-200/80 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                              Refill Target
                            </span>
                            <span className="text-xs font-bold text-teal-800">{refillDateStr}</span>
                            {getRefillPreview(item).isSyrup && (
                              <span className="block mt-0.5 w-fit px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                                Syrup (Next Day)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500 pt-1 border-t border-gray-100">
                            <span>~{supplyDays}d supply</span>
                            <span className="text-amber-700 font-bold">₹{approxTotalCost.toFixed(0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Search Bar for Adding Medicines */}
            <div className="relative" ref={medRef}>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder={
                    prescribedMeds.length === 0
                      ? 'Type brand name (e.g. Telvas, Glycomet, Aptamil, Metformin)...'
                      : '+ Add another medicine to this customer (type brand name)...'
                  }
                  value={medSearch}
                  onFocus={() => {
                    setMedDropdownOpen(true);
                    if (medicines.length === 0) searchMedicines(medSearch);
                  }}
                  onChange={(e) => handleMedSearchChange(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none shadow-xs"
                />
                {medSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setMedSearch('');
                      searchMedicines('');
                    }}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Live Dropdown Results (Prefix-First) */}
              {medDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-xl z-50 divide-y divide-gray-50">
                  {medLoading ? (
                    <div className="p-4 text-xs text-gray-400 text-center">Searching 9,259 medicines...</div>
                  ) : medicines.length === 0 ? (
                    <div className="p-4 text-xs text-gray-400 text-center">No matching medicines found</div>
                  ) : (
                    medicines.map((m) => {
                      const isAlreadyAdded = prescribedMeds.some((p) => p.medicine.id === m.id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => !isAlreadyAdded && handleAddMedicine(m)}
                          className={`p-3 flex items-center justify-between transition-colors ${
                            isAlreadyAdded
                              ? 'bg-gray-50 opacity-60 cursor-not-allowed'
                              : 'hover:bg-teal-50/70 cursor-pointer'
                          }`}
                        >
                          <div className="pr-3">
                            <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">{m.manufacturer || 'Indian Pharma'}</span>
                              <span className="text-[10px] bg-gray-100 px-1.5 py-0.2 rounded font-mono text-gray-600">
                                {m.unitsPerPack} tabs/strip
                              </span>
                              <span className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.2 rounded font-semibold">
                                MRP ₹{m.mrp}
                              </span>
                            </div>
                          </div>
                          {isAlreadyAdded ? (
                            <span className="text-[11px] font-semibold text-gray-400">Added</span>
                          ) : (
                            <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1">
                              <Plus size={12} /> Add
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              {saving
                ? 'Saving Patient...'
                : prescribedMeds.length === 0
                ? 'Save Patient Profile'
                : prescribedMeds.length === 1
                ? 'Save Patient & 1 Medicine'
                : `Save Patient & ${prescribedMeds.length} Medicines`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
