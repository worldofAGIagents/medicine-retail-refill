'use client';

import { DashboardLayout } from '@/components/layout';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Phone, MapPin, Pill, X, Check, Eye, UserPlus, Heart, Sparkles, Calendar, Clock } from 'lucide-react';
import { OnboardPatientModal } from '@/components/OnboardPatientModal';
import {
  getLocalCustomers,
  saveLocalCustomers,
  mergeCustomerLists,
  CUSTOMERS_UPDATED_EVENT,
  clean10DigitPhone,
} from '@/lib/customer-sync';

interface PrescriptionWithMedicine {
  id: string;
  dailyDosage: number;
  nextRefillDate: string | null;
  lastPurchaseQty?: number;
  customPackaging?: string;
  medicine: {
    id?: string;
    name: string;
    category: string;
    genericName: string;
    unitsPerPack?: number;
    mrp?: number;
  };
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  altPhone?: string;
  address?: string;
  locality?: string;
  city?: string;
  primaryCondition?: string | null;
  whatsappEnabled: boolean;
  prescriptions: PrescriptionWithMedicine[];
}

// Guarantee zero duplicate prescriptions per customer
function sanitizeCustomer(c: Customer): Customer {
  const seenMeds = new Set<string>();
  const cleanPrescriptions = (c.prescriptions || []).filter((p) => {
    const medKey = (p.medicine?.name || (p.medicine as any)?.id || p.id || '').trim().toLowerCase();
    if (!medKey || seenMeds.has(medKey)) return false;
    seenMeds.add(medKey);
    return true;
  });
  return {
    ...c,
    prescriptions: cleanPrescriptions,
  };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>(() => {
    if (typeof window !== 'undefined') {
      return getLocalCustomers() as Customer[];
    }
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return getLocalCustomers().length === 0;
    }
    return true;
  });
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);

  const loadCustomers = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    lastFetchTimeRef.current = Date.now();

    try {
      const localList = getLocalCustomers() as Customer[];
      const res = await fetch(`/api/customers?t=${Date.now()}`, { cache: 'no-store' });
      const serverData = await res.json();
      const rawSList: Customer[] = Array.isArray(serverData) ? serverData : [];
      const cleanMerged = mergeCustomerLists(rawSList as any, localList as any, true) as Customer[];
      setCustomers(cleanMerged);
      // Suppress broadcast so server sync does not re-trigger an event loop!
      saveLocalCustomers(cleanMerged as any, { source: 'server_sync', broadcast: false });
    } catch (e) {
      console.warn('Failed to fetch customers:', e);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Initial hydration
    const local = getLocalCustomers() as Customer[];
    if (local.length > 0) {
      setCustomers(local);
      setLoading(false);
    }

    // 2. Fetch server truth
    loadCustomers();

    // 3. Local update handler: updates in-memory state WITHOUT network fetch
    const handleLocalUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (customEvt.detail?.source === 'server_sync') return; // Ignore our own sync

      if (customEvt.detail?.customers) {
        setCustomers(customEvt.detail.customers);
      } else {
        setCustomers(getLocalCustomers() as Customer[]);
      }
    };

    // 4. Throttled focus handler: re-fetch only if > 30s have elapsed
    const handleFocus = () => {
      if (Date.now() - lastFetchTimeRef.current > 30000) {
        loadCustomers();
      }
    };

    window.addEventListener(CUSTOMERS_UPDATED_EVENT, handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener(CUSTOMERS_UPDATED_EVENT, handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadCustomers]);

  const categories = ['All', 'Blood Pressure', 'Diabetes', 'Thyroid', 'Heart', 'Infant Milk', 'Cholesterol', 'Gastric'];

  // Filter customers by search and condition
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.altPhone && c.altPhone.includes(search)) ||
      (c.locality && c.locality.toLowerCase().includes(search.toLowerCase())) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (category === 'All') return true;

    const catQuery = category.toLowerCase();
    const cond = (c.primaryCondition || '').toLowerCase();
    if (cond.includes(catQuery)) return true;
    if ((catQuery === 'blood pressure' || catQuery === 'bp') && (cond.includes('bp') || cond.includes('blood pressure'))) return true;

    // Check if customer has any prescription with this category
    return c.prescriptions?.some((p) => {
      const medCat = p.medicine?.category?.toLowerCase() || '';
      if (catQuery === 'bp' || catQuery === 'blood pressure') return medCat.includes('bp') || medCat.includes('blood pressure');
      return medCat.includes(catQuery);
    });
  });

  return (
    <DashboardLayout>
      <div className="p-2 md:p-4 max-w-7xl mx-auto">
        {/* Clean Header Without Redundant Banner */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-gray-900">Chronic Patients Roster</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Active chronic prescriptions, refill target countdowns &amp; village delivery profiles
            </p>
          </div>
          <button
            onClick={() => setShowOnboardModal(true)}
            className="w-full sm:w-auto justify-center bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <UserPlus size={18} /> Onboard Patient
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-start md:items-center">
          <div className="flex gap-2 overflow-x-auto pb-1 w-full md:w-auto">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  category === c
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, phone, village..."
              className="pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Customer Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading patients...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3">
                <Heart className="w-6 h-6" />
              </div>
              <p className="text-base font-semibold text-gray-800">No chronic patients found</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Onboard a patient with BP, Diabetes, Thyroid or baby food to start automatic refill tracking.
              </p>
              <button
                onClick={() => setShowOnboardModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" /> Onboard Patient
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Patient &amp; Condition</th>
                    <th className="py-3.5 px-4">Contact &amp; Village</th>
                    <th className="py-3.5 px-4">Active Medicines</th>
                    <th className="py-3.5 px-4 text-center">Prescriptions</th>
                    <th className="py-3.5 px-4">Next Refill Date</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCustomers.map((c) => {
                    const initials = c.name
                      .split(' ')
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    // Find nearest refill date & days remaining
                    let nearestRefillDateStr: string | null = null;
                    let daysLeft: number | null = null;

                    c.prescriptions?.forEach((p) => {
                      if (p.nextRefillDate) {
                        if (!nearestRefillDateStr || new Date(p.nextRefillDate) < new Date(nearestRefillDateStr)) {
                          nearestRefillDateStr = p.nextRefillDate;
                          daysLeft = Math.ceil((new Date(p.nextRefillDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        }
                      }
                    });

                    // Single clean village name without repetition
                    const villageName = c.locality || (c.address ? c.address.replace(/गाँव:?\s*/i, '').split(',')[0].trim() : 'Sarfuddinpur');

                    return (
                      <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                        {/* 1. Patient Name + Condition Pill */}
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {initials || 'CU'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900">{c.name}</p>
                                {c.primaryCondition && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                                    {c.primaryCondition}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                ID: #{c.id.replace('local-', '').slice(-6)}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 2. Contact & Village (Zero Duplication) */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-gray-800 font-medium text-xs">
                            <Phone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span>{c.phone}</span>
                            {c.whatsappEnabled && (
                              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.2 rounded font-bold">
                                WA
                              </span>
                            )}
                          </div>
                          {c.altPhone && (
                            <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                              <span>Alt: {c.altPhone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-amber-900 font-medium mt-1">
                            <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
                            <span className="bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                              {villageName}
                            </span>
                          </div>
                        </td>

                        {/* 3. Active Medicines (Unique, with dosage) */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {c.prescriptions && c.prescriptions.length > 0 ? (
                              c.prescriptions.map((p, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-teal-50 text-teal-800 border border-teal-100"
                                >
                                  <Pill className="w-3 h-3 text-teal-600 shrink-0" />
                                  <span>{p.medicine?.name}</span>
                                  <span className="text-[10px] text-teal-600 font-bold">({p.dailyDosage}/day)</span>
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">No active medicines</span>
                            )}
                          </div>
                        </td>

                        {/* 4. Unique Prescriptions Count */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold">
                            {c.prescriptions?.length || 0}
                          </span>
                        </td>

                        {/* 5. Nearest Next Refill Date with Countdown */}
                        <td className="py-3.5 px-4">
                          {nearestRefillDateStr ? (
                            <div>
                              <p className="text-xs font-bold text-gray-900">
                                {new Date(nearestRefillDateStr).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                              <span
                                className={`inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  daysLeft !== null && daysLeft <= 2
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : daysLeft !== null && daysLeft <= 7
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {daysLeft !== null && daysLeft <= 0
                                  ? `${Math.abs(daysLeft)}d overdue`
                                  : daysLeft !== null && daysLeft <= 7
                                  ? `Due in ${daysLeft} days`
                                  : 'Auto-Refill Active'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>

                        {/* 6. Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setViewCustomer(c)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer border border-teal-100"
                          >
                            <Eye className="w-3.5 h-3.5" /> Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
            <span>Showing {filteredCustomers.length} chronic patient(s)</span>
          </div>
        </div>

        {/* View Customer Modal */}
        {viewCustomer && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-base">
                    {viewCustomer.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{viewCustomer.name}</h3>
                    <p className="text-xs text-gray-500">{viewCustomer.phone}</p>
                  </div>
                </div>
                <button onClick={() => setViewCustomer(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                {viewCustomer.primaryCondition && (
                  <div>
                    <span className="text-xs text-gray-400 uppercase font-semibold">Primary Condition</span>
                    <p className="text-teal-700 font-bold text-sm mt-0.5">{viewCustomer.primaryCondition}</p>
                  </div>
                )}

                {viewCustomer.altPhone && (
                  <div>
                    <span className="text-xs text-gray-400 uppercase font-semibold">Family / Alternate Phone</span>
                    <p className="text-gray-800 font-medium mt-0.5">{viewCustomer.altPhone}</p>
                  </div>
                )}

                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold">Delivery Village &amp; Address</span>
                  <p className="text-gray-700 font-medium mt-0.5">
                    {viewCustomer.locality ? `Village: ${viewCustomer.locality}` : ''}
                    {viewCustomer.address && viewCustomer.address !== viewCustomer.locality ? ` (${viewCustomer.address})` : ''}
                    {viewCustomer.city ? `, ${viewCustomer.city}` : ', Muzaffarpur'}
                  </p>
                </div>

                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold">
                    Prescribed Medicines ({viewCustomer.prescriptions?.length || 0})
                  </span>
                  <div className="mt-2 space-y-2">
                    {viewCustomer.prescriptions?.map((p, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">{p.medicine?.name}</p>
                          <p className="text-xs text-gray-500">
                            {p.medicine?.genericName || ''} • {p.dailyDosage} dose/day • {p.customPackaging || 'Strips'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-teal-700">
                            {p.nextRefillDate ? new Date(p.nextRefillDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No date'}
                          </span>
                          <p className="text-[10px] text-gray-400">Refill Target</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end">
                <button
                  onClick={() => setViewCustomer(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Onboard Patient Modal */}
        <OnboardPatientModal
          isOpen={showOnboardModal}
          onClose={() => setShowOnboardModal(false)}
          onSuccess={() => loadCustomers()}
        />
      </div>
    </DashboardLayout>
  );
}
