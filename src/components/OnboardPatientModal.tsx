'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X, UserPlus, Phone, MapPin, Search, CheckCircle2,
  AlertCircle, Pill, Calendar, Clock, Heart, Sparkles, Activity
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

  // Medicine Selection State
  const [medSearch, setMedSearch] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);
  const [medDropdownOpen, setMedDropdownOpen] = useState(false);
  const [medLoading, setMedLoading] = useState(false);

  // Dosage & Supply State
  const [dosage, setDosage] = useState(1);
  const [qty, setQty] = useState(30);
  const [bufferDays, setBufferDays] = useState(3);
  const [doctorName, setDoctorName] = useState('');

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

  // Search medicines from live 9,259 catalog
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
    }, 250);
  };

  const handleSelectMed = (med: Medicine) => {
    setSelectedMed(med);
    setMedSearch(med.name);
    setMedDropdownOpen(false);

    if (condition === 'Infant Milk' || med.category === 'Infant Milk' || med.packagingType === 'tin') {
      setDosage(40); // 40 grams / day default
      setQty(med.unitsPerPack || 400); // 1 tin = 400g
      setBufferDays(2);
    } else {
      setDosage(1);
      setQty((med.unitsPerPack || 10) * 3); // 3 strips
      setBufferDays(3);
    }
  };

  // Calculate live next refill preview
  const daysOfSupply = qty && dosage ? Math.floor(qty / dosage) : 0;
  const nextRefillDate = new Date();
  nextRefillDate.setDate(nextRefillDate.getDate() + Math.max(1, daysOfSupply - bufferDays));
  const refillDateString = nextRefillDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

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

    setSaving(true);
    try {
      const res = await fetch('/api/customers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          address: address.trim(),
          primaryCondition: condition,
          medicineId: selectedMed?.id,
          dailyDosage: Number(dosage),
          lastPurchaseQty: Number(qty),
          lastPurchaseDate: new Date().toISOString(),
          bufferDays: Number(bufferDays),
          doctorName: doctorName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to onboard patient');
        setSaving(false);
        return;
      }

      setSuccessMsg(`Patient ${name} onboarded! Next refill set for ${refillDateString}`);
      setTimeout(() => {
        onSuccess?.();
        onClose();
        // Reset form
        setName('');
        setPhone('');
        setAddress('');
        setSelectedMed(null);
        setMedSearch('');
        setSuccessMsg('');
        setSaving(false);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with server');
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto border border-gray-100">
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
              Add customer profile, select their repeat medicine, and auto-categorize in one step
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
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

          {/* Step 3: Medicine Search across 9,259 Shop Catalogue */}
          <div className="space-y-2" ref={medRef}>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              3. Select Regular Medicine (From Shop MARG Inventory)
            </label>

            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Type brand name (e.g. Telvas, Glycomet, Aptamil, Abixim)..."
                value={medSearch}
                onFocus={() => {
                  setMedDropdownOpen(true);
                  if (medicines.length === 0) searchMedicines(medSearch);
                }}
                onChange={(e) => handleMedSearchChange(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
              {selectedMed && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMed(null);
                    setMedSearch('');
                    searchMedicines('');
                  }}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Medicine Results Dropdown */}
            {medDropdownOpen && (
              <div className="absolute left-6 right-6 sm:left-auto sm:right-auto sm:w-[500px] mt-1 max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-xl z-50 divide-y divide-gray-50">
                {medLoading ? (
                  <div className="p-4 text-xs text-gray-400 text-center">Searching 9,000+ medicines...</div>
                ) : medicines.length === 0 ? (
                  <div className="p-4 text-xs text-gray-400 text-center">No matching medicines found</div>
                ) : (
                  medicines.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleSelectMed(m)}
                      className="p-3 hover:bg-teal-50/70 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="pr-3">
                        <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{m.manufacturer || 'Indian Pharma'}</span>
                          <span className="text-[10px] bg-gray-100 px-1.5 py-0.2 rounded font-mono text-gray-600">
                            MRP ₹{m.mrp}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg shrink-0">
                        Select
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {selectedMed && (
              <div className="p-3 bg-teal-50/80 rounded-2xl border border-teal-200 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-teal-900">{selectedMed.name}</p>
                  <p className="text-teal-700 text-[11px] mt-0.5">
                    Will be categorized as <span className="font-bold underline">{condition}</span> in shop catalog!
                  </p>
                </div>
                <span className="text-teal-800 font-bold bg-white px-2.5 py-1 rounded-lg shadow-2xs">
                  ₹{selectedMed.mrp}
                </span>
              </div>
            )}
          </div>

          {/* Step 4: Dosage & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Quantity Bought Today</label>
              <input
                type="number"
                min={1}
                required
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
              <span className="text-[10px] text-gray-400">e.g. 30 tabs / 1 tin</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Daily Usage</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                required
                value={dosage}
                onChange={(e) => setDosage(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
              <span className="text-[10px] text-gray-400">tabs or grams / day</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reminder Advance</label>
              <select
                value={bufferDays}
                onChange={(e) => setBufferDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              >
                <option value={2}>2 days before</option>
                <option value={3}>3 days before</option>
                <option value={5}>5 days before</option>
              </select>
              <span className="text-[10px] text-gray-400">auto-WhatsApp timing</span>
            </div>
          </div>

          {/* Refill Calculation Summary Callout */}
          <div className="p-3.5 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl border border-teal-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Calendar className="text-teal-700 w-4 h-4" />
              <div>
                <span className="text-teal-900 font-semibold">Supply: ~{daysOfSupply} days</span>
                <p className="text-teal-700 text-[11px]">First WhatsApp Refill Alert: <strong>{refillDateString}</strong></p>
              </div>
            </div>
            <span className="bg-teal-600 text-white font-bold text-[11px] px-2.5 py-1 rounded-full shadow-2xs">
              Auto-Refill Active
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
            >
              {saving ? 'Onboarding Patient...' : 'Save Patient & Activate Refill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
