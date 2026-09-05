'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X, UserPlus, Phone, MapPin, Search, CheckCircle2,
  AlertCircle, Pill, Calendar, Clock, Heart, Sparkles, Plus, Trash2, Layers
} from 'lucide-react';

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
  unitMode: 'strips' | 'tablets' | 'tins';
  stripCount: number;
  totalQty: number;
  dailyDosage: number;
  bufferDays: number;
}

interface OnboardPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CONDITIONS = [
  { id: 'Blood Pressure', label: 'Blood Pressure (BP)', color: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'Diabetes', label: 'Diabetes', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'Thyroid', label: 'Thyroid', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'Heart', label: 'Cardiac / Heart', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'Infant Milk', label: 'Infant Formula / Baby Milk', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { id: 'Cholesterol', label: 'Cholesterol', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'Respiratory', label: 'Asthma / Respiratory', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { id: 'Gastric', label: 'Gastric / GI', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'General', label: 'Other Chronic', color: 'bg-gray-50 text-gray-700 border-gray-200' },
];

export function OnboardPatientModal({ isOpen, onClose, onSuccess }: OnboardPatientModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [condition, setCondition] = useState('Blood Pressure');

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

    const isInfant = condition === 'Infant Milk' || med.category === 'Infant Milk' || med.packagingType === 'tin';
    const packUnits = med.unitsPerPack > 0 ? med.unitsPerPack : 10;

    let newItem: PrescribedMedicineItem;
    if (isInfant) {
      newItem = {
        medicine: med,
        unitMode: 'tins',
        stripCount: 1,
        totalQty: packUnits || 400,
        dailyDosage: 40, // 40 grams / day default
        bufferDays: 2,
      };
    } else {
      const defaultStrips = 2; // e.g. 2 strips default
      newItem = {
        medicine: med,
        unitMode: 'strips',
        stripCount: defaultStrips,
        totalQty: defaultStrips * packUnits,
        dailyDosage: 1, // 1 tablet / day default
        bufferDays: 3,
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

      const packUnits = current.medicine.unitsPerPack > 0 ? current.medicine.unitsPerPack : 10;

      // If stripCount changed in strips mode, update totalQty
      if (updates.stripCount !== undefined && merged.unitMode === 'strips') {
        merged.totalQty = Math.max(1, updates.stripCount) * packUnits;
      }

      // If unitMode switched to strips, recalculate totalQty from stripCount
      if (updates.unitMode === 'strips') {
        merged.stripCount = merged.stripCount > 0 ? merged.stripCount : 1;
        merged.totalQty = merged.stripCount * packUnits;
      }

      updated[index] = merged;
      return updated;
    });
  };

  // Compute refill dates preview for an item
  const getRefillPreview = (item: PrescribedMedicineItem) => {
    const supplyDays = item.dailyDosage > 0 ? Math.floor(item.totalQty / item.dailyDosage) : 0;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + Math.max(1, supplyDays - item.bufferDays));
    return {
      supplyDays,
      refillDateStr: targetDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
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

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number');
      return;
    }

    if (prescribedMeds.length === 0) {
      setErrorMsg('Please search and add at least one medicine for the patient');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: cleanPhone,
        address: address.trim(),
        primaryCondition: condition,
        medicines: prescribedMeds.map((item) => {
          const packUnits = item.medicine.unitsPerPack > 0 ? item.medicine.unitsPerPack : 10;
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
            dailyDosage: Number(item.dailyDosage) || 1,
            lastPurchaseQty: Number(item.totalQty) || 30,
            lastPurchaseDate: new Date().toISOString(),
            bufferDays: Number(item.bufferDays) || 3,
            customPackaging: packagingDesc,
            unitType: item.unitMode === 'tins' ? 'grams' : 'tablets',
          };
        }),
      };

      const res = await fetch('/api/customers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to onboard patient');
        setSaving(false);
        return;
      }

      setSuccessMsg(`Patient ${name} onboarded with ${prescribedMeds.length} medicine(s) successfully!`);
      setTimeout(() => {
        onSuccess?.();
        onClose();
        // Reset form
        setName('');
        setPhone('');
        setAddress('');
        setPrescribedMeds([]);
        setMedSearch('');
        setSuccessMsg('');
        setSaving(false);
      }, 900);
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

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Delivery Address / Locality</label>
              <input
                type="text"
                placeholder="House No, Apartment, Sector / Colony, City"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
          </div>

          {/* Step 2: Chronic Condition */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              2. Select Chronic Condition / Category
            </label>
            <div className="flex flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCondition(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    condition === c.id
                      ? 'bg-teal-700 text-white border-teal-800 shadow-xs scale-102'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Prescribed Medicines List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                3. Customer Medicines ({prescribedMeds.length} added)
              </label>
              <span className="text-[11px] text-teal-700 font-semibold bg-teal-50 px-2 py-0.5 rounded-md">
                Strips / Packs auto-converted
              </span>
            </div>

            {/* List of currently selected medicines */}
            {prescribedMeds.length > 0 && (
              <div className="space-y-3">
                {prescribedMeds.map((item, idx) => {
                  const packUnits = item.medicine.unitsPerPack > 0 ? item.medicine.unitsPerPack : 10;
                  const { supplyDays, refillDateStr } = getRefillPreview(item);

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
                          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 pl-7">
                            <span>{item.medicine.manufacturer || 'Indian Pharma'}</span>
                            <span>•</span>
                            <span className="font-semibold text-teal-800">
                              {packUnits} {item.unitMode === 'tins' ? 'g Tin' : 'tabs/strip'}
                            </span>
                            <span>•</span>
                            <span>MRP ₹{item.medicine.mrp}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveMedicine(idx)}
                          className="text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
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
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={item.stripCount}
                                  onChange={(e) =>
                                    handleUpdateMedicine(idx, { stripCount: Math.max(1, Number(e.target.value) || 1) })
                                  }
                                  className="w-20 px-2.5 py-1.5 text-sm font-bold bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                                />
                                <span className="text-xs font-semibold text-gray-600">
                                  strip(s)
                                </span>
                              </div>
                              <p className="text-[11px] text-teal-700 font-medium mt-1">
                                = <strong>{item.totalQty}</strong> tablets total
                              </p>
                            </div>
                          ) : item.unitMode === 'tins' ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={item.stripCount}
                                  onChange={(e) =>
                                    handleUpdateMedicine(idx, {
                                      stripCount: Math.max(1, Number(e.target.value) || 1),
                                      totalQty: Math.max(1, Number(e.target.value) || 1) * packUnits,
                                    })
                                  }
                                  className="w-20 px-2.5 py-1.5 text-sm font-bold bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                                />
                                <span className="text-xs font-semibold text-gray-600">tin(s)</span>
                              </div>
                              <p className="text-[11px] text-teal-700 font-medium mt-1">
                                = <strong>{item.totalQty}g</strong> powder total
                              </p>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="number"
                                min={1}
                                value={item.totalQty}
                                onChange={(e) =>
                                  handleUpdateMedicine(idx, { totalQty: Math.max(1, Number(e.target.value) || 1) })
                                }
                                className="w-full px-2.5 py-1.5 text-sm font-bold bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                              />
                              <p className="text-[11px] text-gray-400 mt-1">total loose tablets</p>
                            </div>
                          )}
                        </div>

                        {/* Daily Usage */}
                        <div>
                          <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                            Daily Usage
                          </label>
                          <input
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={item.dailyDosage}
                            onChange={(e) =>
                              handleUpdateMedicine(idx, { dailyDosage: Math.max(0.5, Number(e.target.value) || 1) })
                            }
                            className="w-full px-2.5 py-1.5 text-sm font-bold bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                          />
                          <p className="text-[11px] text-gray-400 mt-1">
                            {item.unitMode === 'tins' ? 'grams / day' : 'tablet(s) / day'}
                          </p>
                        </div>

                        {/* Schedule & Refill Target */}
                        <div className="bg-white p-2 rounded-xl border border-gray-200/80 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                              Refill Target
                            </span>
                            <span className="text-xs font-bold text-teal-800">{refillDateStr}</span>
                          </div>
                          <span className="text-[10px] font-semibold text-gray-500">
                            ~{supplyDays} days of supply
                          </span>
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
                ? 'Onboarding Patient...'
                : prescribedMeds.length > 1
                ? `Save Patient & ${prescribedMeds.length} Medicines`
                : 'Save Patient & Activate Refill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
