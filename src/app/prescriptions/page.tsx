'use client';

import { DashboardLayout } from '@/components/layout';
import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, Calendar, Activity, Pill, User, Clock, CheckCircle2,
  ChevronDown, X, Edit3, PackageCheck, Milk, Sparkles, Filter
} from 'lucide-react';

interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  packagingType: string;
  unitsPerPack: number;
  packsPerBox: number;
  mrp: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  city?: string;
}

interface PrescriptionItem {
  id: string;
  customerId: string;
  medicineId: string;
  dailyDosage: number;
  dosageSchedule: string | null;
  doctorName: string | null;
  lastPurchaseDate: string;
  lastPurchaseQty: number;
  nextRefillDate: string;
  bufferDays: number;
  customPackaging?: string | null;
  unitType?: string | null;
  isActive: boolean;
  customer: Customer;
  medicine: Medicine;
  refillStatus?: {
    daysRemaining: number;
    urgency: 'overdue' | 'urgent' | 'due_soon' | 'ok' | 'future';
    nextRefillDate: string;
  };
}

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Dropdown list data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);

  // Search & Combobox states
  const [custSearch, setCustSearch] = useState('');
  const [custDropdownOpen, setCustDropdownOpen] = useState(false);
  const [medSearch, setMedSearch] = useState('');
  const [medCategoryFilter, setMedCategoryFilter] = useState('All');
  const [medDropdownOpen, setMedDropdownOpen] = useState(false);

  // Form selection states
  const [customerId, setCustomerId] = useState('');
  const [medicineId, setMedicineId] = useState('');
  const [dosage, setDosage] = useState(1);
  const [schedule, setSchedule] = useState({ morning: true, afternoon: false, evening: false, night: false });
  const [lastPurchase, setLastPurchase] = useState(new Date().toISOString().split('T')[0]);
  const [qty, setQty] = useState(30);
  const [bufferDays, setBufferDays] = useState(3);
  const [doctorName, setDoctorName] = useState('');

  // Custom Packaging states (When imported MARG packaging is unknown or custom)
  const [overridePackaging, setOverridePackaging] = useState(false);
  const [customPackagingText, setCustomPackagingText] = useState('');
  const [customUnitType, setCustomUnitType] = useState('tablets');
  const [customUnitsPerPack, setCustomUnitsPerPack] = useState(10);

  // Table filtering states
  const [tableSearch, setTableSearch] = useState('');
  const [tableCategory, setTableCategory] = useState('All');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const custRef = useRef<HTMLDivElement>(null);
  const medRef = useRef<HTMLDivElement>(null);

  const loadPrescriptions = () => {
    setLoading(true);
    fetch('/api/prescriptions')
      .then((res) => res.json())
      .then((data) => {
        setPrescriptions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadPrescriptions();

    fetch('/api/customers')
      .then((res) => res.json())
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(console.error);

    fetch('/api/medicines')
      .then((res) => res.json())
      .then((data) => setMedicines(Array.isArray(data) ? data : []))
      .catch(console.error);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (custRef.current && !custRef.current.contains(event.target as Node)) {
        setCustDropdownOpen(false);
      }
      if (medRef.current && !medRef.current.contains(event.target as Node)) {
        setMedDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedMed = medicines.find((m) => m.id === medicineId);
  const selectedCust = customers.find((c) => c.id === customerId);

  // Effective packaging units
  const effectiveUnitsPerPack = overridePackaging
    ? Number(customUnitsPerPack) || 10
    : selectedMed?.unitsPerPack || 10;

  const isInfantMilk = selectedMed?.category === 'Infant Milk' || customUnitType === 'grams';

  // Calculate supply and refill dates
  const daysOfSupply = qty && dosage ? Math.floor(qty / dosage) : 0;
  const purchaseDateObj = new Date(lastPurchase || Date.now());
  const runOutDateObj = new Date(purchaseDateObj);
  runOutDateObj.setDate(runOutDateObj.getDate() + daysOfSupply);

  const refillTargetDate = new Date(runOutDateObj);
  refillTargetDate.setDate(refillTargetDate.getDate() - bufferDays);

  const handleSelectMedicine = (med: Medicine) => {
    setMedicineId(med.id);
    setMedSearch(med.name);
    setMedDropdownOpen(false);

    if (med.category === 'Infant Milk') {
      setCustomUnitType('grams');
      setDosage(40); // 40 grams / day default for infant milk
      setQty(med.unitsPerPack || 400); // 1 tin (400g)
      setCustomPackagingText(`${med.unitsPerPack || 400}g Tin`);
      setCustomUnitsPerPack(med.unitsPerPack || 400);
      setBufferDays(2);
    } else {
      setCustomUnitType('tablets');
      setDosage(1);
      setQty((med.unitsPerPack || 10) * 3); // 3 strips
      setCustomPackagingText(`${med.unitsPerPack || 10} tablets per strip`);
      setCustomUnitsPerPack(med.unitsPerPack || 10);
      setBufferDays(3);
    }
  };

  const handleSelectCustomer = (cust: Customer) => {
    setCustomerId(cust.id);
    setCustSearch(`${cust.name} (${cust.phone})`);
    setCustDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !medicineId) return;

    setSubmitting(true);
    const scheduleStr = Object.entries(schedule)
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join('+');

    try {
      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          medicineId,
          dailyDosage: Number(dosage),
          dosageSchedule: isInfantMilk ? `${dosage}g daily` : (scheduleStr || 'daily'),
          doctorName: doctorName || null,
          lastPurchaseDate: new Date(lastPurchase),
          lastPurchaseQty: Number(qty),
          bufferDays: Number(bufferDays),
          customPackaging: overridePackaging ? customPackagingText : (selectedMed?.category === 'Infant Milk' ? '400g Tin' : `${selectedMed?.unitsPerPack} tabs/strip`),
          unitType: customUnitType,
        }),
      });

      if (res.ok) {
        setSuccessMsg('Prescription & Auto-Refill schedule configured successfully!');
        setTimeout(() => setSuccessMsg(''), 4000);
        setShowForm(false);
        // Reset form
        setCustomerId('');
        setMedicineId('');
        setMedSearch('');
        setCustSearch('');
        setOverridePackaging(false);
        loadPrescriptions();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter medicines in searchable combobox
  const filteredMedicinesForCombobox = medicines.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(medSearch.toLowerCase()) ||
      m.genericName.toLowerCase().includes(medSearch.toLowerCase()) ||
      m.category.toLowerCase().includes(medSearch.toLowerCase());

    if (!matchesSearch) return false;
    if (medCategoryFilter === 'All') return true;
    return m.category.toLowerCase().includes(medCategoryFilter.toLowerCase());
  });

  // Filter customers in searchable combobox
  const filteredCustomersForCombobox = customers.filter((c) =>
    c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
    c.phone.includes(custSearch)
  );

  // Filter table items
  const filteredTablePrescriptions = prescriptions.filter((p) => {
    const matchesSearch =
      p.customer?.name?.toLowerCase().includes(tableSearch.toLowerCase()) ||
      p.customer?.phone?.includes(tableSearch) ||
      p.medicine?.name?.toLowerCase().includes(tableSearch.toLowerCase());

    if (!matchesSearch) return false;
    if (tableCategory === 'All') return true;
    return p.medicine?.category?.toLowerCase().includes(tableCategory.toLowerCase());
  });

  const allCategories = ['All', 'Diabetes', 'BP', 'Thyroid', 'Cholesterol', 'Infant Milk', 'Heart'];

  return (
    <DashboardLayout>
      <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-gray-900">Chronic &amp; Infant Refill Prescriptions</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Manage repeat subscriptions for chronic medicines, infant milk formulas, and packaging sizes
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full sm:w-auto justify-center bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold shadow-sm transition-colors"
            >
              <Plus size={18} /> Add New Prescription
            </button>
          )}
        </div>

        {successMsg && (
          <div className="bg-teal-50 border border-teal-200 text-teal-800 p-4 rounded-xl flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* ---------------- NEW PRESCRIPTION FORM ---------------- */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
                  <Activity size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-heading text-gray-900">Configure Refill Prescription</h2>
                  <p className="text-xs text-gray-500">Search customer &amp; medicine, verify packaging size, and set daily usage</p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-xs font-semibold text-gray-400 hover:text-gray-700 px-3 py-1 rounded-lg border border-gray-200"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* LEFT COLUMN: Customer & Searchable Medicine */}
                <div className="space-y-5">
                  
                  {/* 1. SEARCHABLE CUSTOMER SELECTOR */}
                  <div className="relative" ref={custRef}>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      1. Select Patient / Parent (Search by name or phone)
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Type customer name or phone..."
                        value={custSearch}
                        onFocus={() => setCustDropdownOpen(true)}
                        onChange={(e) => {
                          setCustSearch(e.target.value);
                          setCustDropdownOpen(true);
                        }}
                        className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      />
                      {customerId && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerId('');
                            setCustSearch('');
                          }}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {/* Customer Dropdown */}
                    {custDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-30 divide-y divide-gray-50">
                        {filteredCustomersForCombobox.length === 0 ? (
                          <div className="p-3 text-xs text-gray-400 text-center">No customers found</div>
                        ) : (
                          filteredCustomersForCombobox.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => handleSelectCustomer(c)}
                              className="p-3 hover:bg-teal-50/60 cursor-pointer flex items-center justify-between"
                            >
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                                <p className="text-xs text-gray-500">{c.phone} • {c.address || c.city || 'Local'}</p>
                              </div>
                              <span className="text-xs text-teal-600 font-semibold">Select</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {selectedCust && (
                      <div className="mt-2 p-2.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-700 flex justify-between items-center">
                        <span><strong>Selected:</strong> {selectedCust.name} ({selectedCust.phone})</span>
                        <span className="text-gray-500">{selectedCust.address || 'Address on record'}</span>
                      </div>
                    )}
                  </div>

                  {/* 2. SEARCHABLE MEDICINE / INFANT MILK SELECTOR */}
                  <div className="relative" ref={medRef}>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      2. Search Chronic Medicine or Infant Formula (MARG Catalog)
                    </label>

                    {/* Category Filter Pills inside Combobox */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-1.5">
                      {['All', 'Diabetes', 'BP', 'Thyroid', 'Infant Milk', 'Cholesterol'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setMedCategoryFilter(cat)}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                            medCategoryFilter === cat
                              ? 'bg-teal-700 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Search by brand (Glycomet, Nan Pro, Telma) or salt..."
                        value={medSearch}
                        onFocus={() => setMedDropdownOpen(true)}
                        onChange={(e) => {
                          setMedSearch(e.target.value);
                          setMedDropdownOpen(true);
                        }}
                        className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                      />
                      {medicineId && (
                        <button
                          type="button"
                          onClick={() => {
                            setMedicineId('');
                            setMedSearch('');
                          }}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>

                    {/* Medicine Dropdown Results */}
                    {medDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-30 divide-y divide-gray-50">
                        {filteredMedicinesForCombobox.length === 0 ? (
                          <div className="p-4 text-xs text-gray-400 text-center">
                            No matching medicines found. Try another search.
                          </div>
                        ) : (
                          filteredMedicinesForCombobox.map((m) => (
                            <div
                              key={m.id}
                              onClick={() => handleSelectMedicine(m)}
                              className="p-3 hover:bg-teal-50/60 cursor-pointer flex items-center justify-between transition-colors"
                            >
                              <div className="pr-2">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                    m.category === 'Infant Milk' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {m.category}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500">{m.genericName}</p>
                                <p className="text-[11px] text-teal-700 mt-0.5">
                                  Pack: {m.unitsPerPack} {m.category === 'Infant Milk' ? 'g Tin' : 'tabs/strip'} • MRP ₹{m.mrp}
                                </p>
                              </div>
                              <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg">
                                Select
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {selectedMed && (
                      <div className="mt-2 p-3 bg-teal-50/60 rounded-xl border border-teal-100 flex items-center justify-between text-xs text-teal-900">
                        <div>
                          <p className="font-bold text-sm">{selectedMed.name}</p>
                          <p className="text-teal-700">{selectedMed.genericName} • {selectedMed.category}</p>
                        </div>
                        <span className="font-bold text-teal-800 text-sm">₹{selectedMed.mrp}</span>
                      </div>
                    )}
                  </div>

                  {/* 3. CUSTOM PACKAGING OVERRIDE (For MARG Imported medicines where pack size is unknown) */}
                  <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-amber-700" />
                        <span className="text-xs font-bold text-amber-900">
                          Packaging Size Configuration (MARG Sync / Override)
                        </span>
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-amber-900 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={overridePackaging}
                          onChange={(e) => setOverridePackaging(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>Type Custom Packaging</span>
                      </label>
                    </div>

                    {!overridePackaging ? (
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Default detected packaging: <strong>{effectiveUnitsPerPack} {customUnitType} per pack</strong>.
                        If MARG software did not export the correct strip or tin size, check <em>&quot;Type Custom Packaging&quot;</em> to specify exact units.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                            Packaging Label
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 15 tabs/strip or 400g Tin"
                            value={customPackagingText}
                            onChange={(e) => setCustomPackagingText(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                            Unit Type
                          </label>
                          <select
                            value={customUnitType}
                            onChange={(e) => setCustomUnitType(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                          >
                            <option value="tablets">Tablets</option>
                            <option value="grams">Grams (Infant Milk)</option>
                            <option value="capsules">Capsules</option>
                            <option value="ml">ML (Syrup)</option>
                            <option value="sachets">Sachets</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                            Units per Single Pack
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={customUnitsPerPack}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 1;
                              setCustomUnitsPerPack(val);
                              setQty(val * 2);
                            }}
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Doctor Name / Pediatrician (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. S.K. Sen (Pediatrician / Physician)"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>

                {/* RIGHT COLUMN: Usage & Quantity Calculator */}
                <div className="space-y-5">
                  {/* Daily Usage / Dosage */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-2">
                      {isInfantMilk
                        ? 'Daily Consumption (How many grams/scoops does the baby drink daily?)'
                        : 'Daily Usage (How many tablets does the patient take daily?)'}
                    </label>

                    {isInfantMilk ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            min="5"
                            step="5"
                            value={dosage}
                            onChange={(e) => setDosage(Number(e.target.value) || 10)}
                            className="w-32 px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                          />
                          <span className="text-xs text-gray-600 font-medium">grams / day (approx. 4-5 scoops)</span>
                        </div>
                        <div className="flex gap-2">
                          {[30, 40, 50, 60].map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setDosage(g)}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                                dosage === g ? 'bg-purple-600 text-white border-purple-600' : 'bg-white border-gray-200 text-gray-700'
                              }`}
                            >
                              {g}g/day
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="grid grid-cols-4 gap-2">
                          {[1, 2, 3, 4].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setDosage(num)}
                              className={`py-2 text-xs font-semibold rounded-xl border transition-colors ${
                                dosage === num
                                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {num} {num === 1 ? 'tablet/day' : 'tablets/day'}
                            </button>
                          ))}
                        </div>

                        {/* Timing Schedule */}
                        <div className="mt-3">
                          <span className="block text-[11px] font-semibold text-gray-500 mb-1.5">Schedule Timing:</span>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            {(['morning', 'afternoon', 'evening', 'night'] as const).map((time) => (
                              <label
                                key={time}
                                className={`flex items-center justify-center p-2 rounded-xl border cursor-pointer font-medium capitalize transition-colors ${
                                  schedule[time]
                                    ? 'bg-teal-50 border-teal-300 text-teal-800'
                                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={schedule[time]}
                                  onChange={(e) => setSchedule({ ...schedule, [time]: e.target.checked })}
                                />
                                {time}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Purchase Date & Reminder Buffer */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Last Purchase Date</label>
                      <input
                        type="date"
                        value={lastPurchase}
                        onChange={(e) => setLastPurchase(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Reminder Buffer (Days Before End)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="7"
                        value={bufferDays}
                        onChange={(e) => setBufferDays(Number(e.target.value) || 2)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* Quantity Delivered / Bought */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Total Quantity Purchased ({customUnitType})
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5 items-start sm:items-center">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={qty}
                          onChange={(e) => setQty(Number(e.target.value) || 0)}
                          className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                          required
                        />
                        <span className="text-xs text-gray-500 font-semibold">{customUnitType}</span>
                      </div>

                      {/* Quick Pack Multipliers */}
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQty(effectiveUnitsPerPack)}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700"
                        >
                          1 Pack ({effectiveUnitsPerPack})
                        </button>
                        <button
                          type="button"
                          onClick={() => setQty(effectiveUnitsPerPack * 2)}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700"
                        >
                          2 Packs ({effectiveUnitsPerPack * 2})
                        </button>
                        <button
                          type="button"
                          onClick={() => setQty(effectiveUnitsPerPack * 3)}
                          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-700"
                        >
                          3 Packs ({effectiveUnitsPerPack * 3})
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* REFILL CALCULATION PREVIEW BOX */}
                  <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-teal-700" />
                        <span className="text-xs uppercase font-bold tracking-wider text-teal-800">
                          Refill Forecast Engine
                        </span>
                      </div>
                      <span className="text-xs font-bold text-teal-900 bg-white px-2.5 py-0.5 rounded-full border border-teal-100">
                        {daysOfSupply} Days of Supply
                      </span>
                    </div>

                    <p className="text-sm font-bold text-gray-900">
                      {qty} {customUnitType} ÷ {dosage} {customUnitType}/day = <span className="text-teal-700">{daysOfSupply} days</span>
                    </p>

                    <div className="flex justify-between text-xs text-gray-600 pt-1 border-t border-teal-100">
                      <span>Runs out: <strong>{runOutDateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                      <span className="text-teal-800 font-bold">
                        WhatsApp Reminder: {refillTargetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="w-full sm:w-auto px-5 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !customerId || !medicineId}
                  className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold text-xs shadow-sm transition-colors text-center"
                >
                  {submitting ? 'Activating...' : 'Save Prescription & Activate Refill'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ---------------- PRESCRIPTIONS LIST TABLE ---------------- */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-bold text-gray-900 font-heading">Active Refill Subscriptions</h3>
              <p className="text-xs text-gray-500">Tracking repeat deliveries for chronic patients and infants</p>
            </div>

            {/* Category Filter Pills on Table */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {allCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setTableCategory(c)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      tableCategory === c
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter prescriptions..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl w-full focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading subscriptions...</div>
          ) : filteredTablePrescriptions.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Pill className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="font-semibold text-gray-700">No prescriptions found</p>
              <p className="text-xs text-gray-400 mt-1">Click &quot;Add New Prescription&quot; to configure a chronic patient</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Patient / Customer</th>
                    <th className="py-3.5 px-4">Item &amp; Category</th>
                    <th className="py-3.5 px-4">Packaging Info</th>
                    <th className="py-3.5 px-4 text-center">Daily Usage</th>
                    <th className="py-3.5 px-4 text-center">Days Supply</th>
                    <th className="py-3.5 px-4">Refill Date</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTablePrescriptions.map((p) => {
                    const daysRemaining = p.refillStatus?.daysRemaining ?? 0;
                    const urgency = p.refillStatus?.urgency ?? 'ok';
                    const nextDate = p.nextRefillDate ? new Date(p.nextRefillDate) : null;
                    const isMilk = p.medicine?.category === 'Infant Milk';

                    return (
                      <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-6">
                          <p className="font-semibold text-gray-900">{p.customer?.name}</p>
                          <p className="text-xs text-gray-400">{p.customer?.phone}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            {isMilk ? (
                              <Milk className="w-4 h-4 text-purple-600 shrink-0" />
                            ) : (
                              <Pill className="w-4 h-4 text-teal-600 shrink-0" />
                            )}
                            <div>
                              <p className="font-semibold text-gray-800 text-xs">{p.medicine?.name}</p>
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                isMilk ? 'bg-purple-100 text-purple-800' : 'bg-blue-50 text-blue-700'
                              }`}>
                                {p.medicine?.category}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="text-xs font-semibold text-gray-800">
                            {p.customPackaging || (isMilk ? '400g Tin' : `${p.medicine?.unitsPerPack} tabs/strip`)}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            Qty: {p.lastPurchaseQty} {p.unitType || 'tablets'}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-teal-50 text-teal-800">
                            {p.dailyDosage} {p.unitType === 'grams' ? 'g/day' : 'tab/day'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`text-xs font-bold ${
                              daysRemaining <= 0
                                ? 'text-red-600'
                                : daysRemaining <= 2
                                ? 'text-red-600'
                                : daysRemaining <= 5
                                ? 'text-amber-600'
                                : 'text-gray-700'
                            }`}
                          >
                            {daysRemaining <= 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining} days`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="text-xs font-bold text-gray-900">
                            {nextDate
                              ? nextDate.toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </p>
                          <span className="text-[10px] text-teal-600 font-medium">Doorstep Refill</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {daysRemaining <= 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Overdue</span>
                          ) : daysRemaining <= 2 ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Urgent</span>
                          ) : daysRemaining <= 5 ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Due Soon</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">OK</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
