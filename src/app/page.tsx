'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout';
import Link from 'next/link';
import {
  Users, RefreshCw, ClipboardList, Package, Plus, Upload,
  ArrowRight, Bell, Sparkles, UserPlus, Heart, CheckCircle2,
  TrendingUp, Phone, MapPin, Pill, Calendar, Clock, QrCode,
  Printer, MessageCircle, AlertTriangle, Search, Filter, Receipt
} from 'lucide-react';
import { OnboardPatientModal } from '@/components/OnboardPatientModal';
import { renderTemplate, DEFAULT_TEMPLATES } from '@/lib/templates';
import { isSyrupMedicine } from '@/lib/refill-engine';

interface PrescriptionItem {
  id: string;
  dailyDosage: number;
  lastPurchaseDate?: string;
  lastPurchaseQty?: number;
  nextRefillDate: string | null;
  customPackaging?: string;
  medicine: {
    id?: string;
    name: string;
    category: string;
    genericName?: string;
    unitsPerPack?: number;
    mrp?: number;
  };
}

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  altPhone?: string;
  address?: string;
  locality?: string;
  city?: string;
  primaryCondition?: string | null;
  whatsappEnabled?: boolean;
  createdAt?: string;
  prescriptions: PrescriptionItem[];
}

interface RefillCardItem {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  village: string;
  condition: string;
  medicineName: string;
  genericName?: string;
  dailyDosage: number;
  customPackaging?: string;
  nextRefillDateStr: string;
  daysRemaining: number;
  urgency: 'overdue' | 'urgent' | 'due_soon' | 'ok';
  isSyrup?: boolean;
}

function sanitizeCustomer(c: CustomerRecord): CustomerRecord {
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

export default function DashboardPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [refillFilter, setRefillFilter] = useState<'all' | 'urgent' | 'week' | 'later'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('All');

  // Load live data from localStorage immediately, then reconcile with server
  const loadData = useCallback(() => {
    let localList: CustomerRecord[] = [];
    try {
      const raw = localStorage.getItem('manoj_local_customers');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localList = parsed.map(sanitizeCustomer);
          setCustomers(localList);
          setLoading(false);
        }
      }
    } catch (e) {
      console.warn('Dashboard local read error:', e);
    }

    // Fetch server data
    fetch('/api/customers')
      .then((res) => res.json())
      .then((serverData) => {
        const rawSList: CustomerRecord[] = Array.isArray(serverData) ? serverData : [];
        const sList = rawSList.map(sanitizeCustomer);
        const serverPhones = new Set(sList.map((c) => c.phone.replace(/[^0-9]/g, '').slice(-10)));

        // Merge: prefer server data for updated status, retain unpersisted local records
        const merged = [...sList];
        localList.forEach((lc) => {
          const lPhone = lc.phone.replace(/[^0-9]/g, '').slice(-10);
          if (!merged.some((m) => m.phone.replace(/[^0-9]/g, '').slice(-10) === lPhone)) {
            merged.push(lc);
          }
        });

        const cleanMerged = merged.map(sanitizeCustomer);
        setCustomers(cleanMerged);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute all refill items with live urgency & days countdown
  const allRefills = useMemo<RefillCardItem[]>(() => {
    const items: RefillCardItem[] = [];
    const todayMs = Date.now();

    customers.forEach((cust) => {
      const village = cust.locality || (cust.address ? cust.address.replace(/गाँव:?\s*/i, '').split(',')[0].trim() : 'Sarfuddinpur');
      const condition = cust.primaryCondition || 'General';

      (cust.prescriptions || []).forEach((p) => {
        if (!p.medicine?.name) return;

        const isSyrup = isSyrupMedicine({
          name: p.medicine.name,
          genericName: p.medicine.genericName,
          category: p.medicine.category,
          customPackaging: p.customPackaging,
        });

        let refillDateMs = todayMs + (isSyrup ? 1 : 15) * 86400000;
        let dateStr = '';
        if (p.nextRefillDate) {
          const parsed = new Date(p.nextRefillDate).getTime();
          if (!isNaN(parsed)) {
            refillDateMs = parsed;
            dateStr = p.nextRefillDate;
          }
        }

        if (!dateStr) {
          const d = new Date(refillDateMs);
          dateStr = d.toISOString();
        }

        const daysRemaining = Math.ceil((refillDateMs - todayMs) / (1000 * 60 * 60 * 24));

        let urgency: 'overdue' | 'urgent' | 'due_soon' | 'ok' = 'ok';
        if (daysRemaining <= 0) urgency = 'overdue';
        else if (daysRemaining <= 2) urgency = 'urgent';
        else if (daysRemaining <= 7) urgency = 'due_soon';

        items.push({
          id: p.id || `refill-${cust.id}-${p.medicine.name}`,
          customerId: cust.id,
          customerName: cust.name,
          phone: cust.phone,
          village,
          condition,
          medicineName: p.medicine.name,
          genericName: p.medicine.genericName,
          dailyDosage: p.dailyDosage || 1,
          customPackaging: p.customPackaging,
          nextRefillDateStr: dateStr,
          daysRemaining,
          urgency,
          isSyrup,
        });
      });
    });

    // Sort: overdue first, then soonest refill dates
    return items.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [customers]);

  // Village summary list
  const villageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    customers.forEach((c) => {
      const v = c.locality || (c.address ? c.address.replace(/गाँव:?\s*/i, '').split(',')[0].trim() : 'Sarfuddinpur');
      counts[v] = (counts[v] || 0) + 1;
    });
    return counts;
  }, [customers]);

  // Total unique active medicines across all patients
  const uniqueMedicinesCount = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      (c.prescriptions || []).forEach((p) => {
        if (p.medicine?.name) set.add(p.medicine.name.trim().toLowerCase());
      });
    });
    return set.size;
  }, [customers]);

  // Urgent / action-needed count (<= 7 days)
  const urgentCount = useMemo(() => {
    return allRefills.filter((r) => r.daysRemaining <= 7).length;
  }, [allRefills]);

  // Filtered refills for table
  const filteredRefills = useMemo(() => {
    return allRefills.filter((r) => {
      // 1. Village filter
      if (selectedVillage !== 'All' && r.village !== selectedVillage) return false;

      // 2. Tab filter
      if (refillFilter === 'urgent' && r.daysRemaining > 2) return false;
      if (refillFilter === 'week' && (r.daysRemaining < 3 || r.daysRemaining > 7)) return false;
      if (refillFilter === 'later' && r.daysRemaining <= 7) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          r.customerName.toLowerCase().includes(q) ||
          r.phone.includes(q) ||
          r.medicineName.toLowerCase().includes(q) ||
          r.village.toLowerCase().includes(q) ||
          r.condition.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [allRefills, refillFilter, selectedVillage, searchQuery]);

  // 1-Click WhatsApp Trigger
  const handleSendWhatsApp = (item: RefillCardItem) => {
    const cleanPhone = item.phone.replace(/[^0-9]/g, '').slice(-10);
    const dateFormatted = new Date(item.nextRefillDateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const daysText =
      item.daysRemaining <= 0
        ? 'आज समाप्त हो रही है'
        : `${item.daysRemaining} दिन (${dateFormatted})`;

    const template = item.daysRemaining <= 0 ? DEFAULT_TEMPLATES.overdueTemplate : DEFAULT_TEMPLATES.hindiTemplate;
    const message = renderTemplate(template, {
      name: item.customerName,
      medicine: item.medicineName,
      days: daysText,
      date: dateFormatted,
      address: item.village,
      phone: '843118 (Manoj Medical Hall)',
    });

    const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const todayDateString = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <DashboardLayout>
      <div className="p-2 sm:p-4 max-w-7xl mx-auto space-y-6">
        {/* Top Command Center Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-gray-900">
                Refill Operations Command Center
              </h1>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync Active
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
              <span>📅 {todayDateString}</span>
              <span>•</span>
              <span className="text-teal-700 font-medium">📍 Sarfuddinpur &amp; 10–20 KM Village Delivery Radius</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <Link
              href="/billing"
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>+ Retail Bill</span>
            </Link>
            <button
              onClick={() => setShowOnboardModal(true)}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Onboard Patient</span>
            </button>
            <Link
              href="/delivery-sheet"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold transition-all"
              title="Print Today's Village Delivery Sheet"
            >
              <Printer className="w-4 h-4 text-gray-500" />
              <span className="hidden sm:inline">Delivery Sheet</span>
            </Link>
            <Link
              href="/quick-qr"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition-all"
              title="Instant Dynamic UPI QR Code"
            >
              <QrCode className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">UPI QR</span>
            </Link>
          </div>
        </div>

        {/* 4 Real Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Patients */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chronic Patients</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1 font-heading">
                  {loading ? '—' : customers.length}
                </p>
                <p className="text-xs text-teal-700 font-medium mt-1 flex items-center gap-1">
                  <span>BP, Sugar, Thyroid, Milk</span>
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 2. Active Medicines Tracked */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Medicines Tracked</p>
                <p className="text-3xl font-extrabold text-gray-900 mt-1 font-heading">
                  {loading ? '—' : uniqueMedicinesCount}
                </p>
                <p className="text-xs text-blue-700 font-medium mt-1 flex items-center gap-1">
                  <span>Repeat prescription items</span>
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Pill className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 3. Action Needed Soon (<= 7 Days) */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Action Needed Soon</p>
                <p className="text-3xl font-extrabold text-amber-600 mt-1 font-heading">
                  {loading ? '—' : urgentCount}
                </p>
                <p className="text-xs text-amber-700 font-medium mt-1 flex items-center gap-1">
                  <span>Refills due in 0–7 days</span>
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* 4. Villages Covered */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Villages Covered</p>
                <p className="text-3xl font-extrabold text-indigo-900 mt-1 font-heading">
                  {loading ? '—' : Object.keys(villageCounts).length}
                </p>
                <p className="text-xs text-indigo-700 font-medium mt-1 truncate max-w-[170px]">
                  {Object.keys(villageCounts).slice(0, 3).join(', ') || 'Sarfuddinpur'}
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Main 2-Column Command Workspace */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* Left Column (2/3 width): Refill Priority Queue */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            {/* Table Header & Controls */}
            <div className="p-4 sm:p-5 border-b border-gray-100 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 font-heading flex items-center gap-2">
                    <span>Upcoming Refills Priority Queue</span>
                    <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-semibold">
                      {filteredRefills.length} items
                    </span>
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Chronologically scheduled chronic medicines with 1-click WhatsApp alerts
                  </p>
                </div>
                <Link
                  href="/refills"
                  className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1"
                >
                  Full Refill Manager <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                {/* Urgency Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <button
                    onClick={() => setRefillFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      refillFilter === 'all'
                        ? 'bg-teal-700 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    All ({allRefills.length})
                  </button>
                  <button
                    onClick={() => setRefillFilter('urgent')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      refillFilter === 'urgent'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    Urgent (0–2d)
                  </button>
                  <button
                    onClick={() => setRefillFilter('week')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      refillFilter === 'week'
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    This Week (3–7d)
                  </button>
                  <button
                    onClick={() => setRefillFilter('later')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      refillFilter === 'later'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    Next 30 Days
                  </button>
                </div>

                {/* Search */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search patient, medicine..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Refills Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-5">Patient &amp; Village</th>
                    <th className="py-3 px-4">Medicine &amp; Dosage</th>
                    <th className="py-3 px-4 text-center">Next Refill</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-5 text-right">WhatsApp Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400 text-xs">
                        Loading scheduled refills...
                      </td>
                    </tr>
                  ) : filteredRefills.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 px-4">
                        <div className="max-w-sm mx-auto space-y-2">
                          <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
                            <Heart className="w-5 h-5" />
                          </div>
                          <p className="text-sm font-semibold text-gray-800">No matching refills</p>
                          <p className="text-xs text-gray-400">
                            {customers.length === 0
                              ? 'Enrol your chronic patients to automatically generate refill countdowns.'
                              : 'All patients are fully stocked for this period.'}
                          </p>
                          {customers.length === 0 && (
                            <button
                              onClick={() => setShowOnboardModal(true)}
                              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" /> Onboard First Patient
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRefills.map((refill) => {
                      const isOverdue = refill.daysRemaining <= 0;
                      const isUrgent = refill.daysRemaining > 0 && refill.daysRemaining <= 2;
                      const isDueSoon = refill.daysRemaining > 2 && refill.daysRemaining <= 7;

                      return (
                        <tr key={refill.id} className="hover:bg-gray-50/60 transition-colors">
                          {/* Patient & Village */}
                          <td className="py-3 px-5">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-gray-900 text-xs sm:text-sm">{refill.customerName}</p>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                                  {refill.condition}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                <span className="flex items-center gap-0.5 font-medium text-amber-800">
                                  <MapPin className="w-3 h-3 text-amber-600" />
                                  {refill.village}
                                </span>
                                <span>•</span>
                                <span className="font-mono text-gray-500">{refill.phone}</span>
                              </div>
                            </div>
                          </td>

                          {/* Medicine & Dosage */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Pill className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                              <span className="font-semibold text-gray-800 text-xs sm:text-sm">{refill.medicineName}</span>
                              {refill.isSyrup && (
                                <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded shadow-2xs">
                                  Syrup • Next Day
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5 pl-5">
                              {refill.dailyDosage} dose/day {refill.customPackaging ? `• ${refill.customPackaging}` : ''}
                            </p>
                          </td>

                          {/* Refill Target Date */}
                          <td className="py-3 px-4 text-center">
                            <p className="text-xs font-bold text-gray-900">
                              {new Date(refill.nextRefillDateStr).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-[10px] text-gray-400">Target Date</p>
                          </td>

                          {/* Status / Countdown Badge */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isOverdue
                                  ? 'bg-red-100 text-red-700 border border-red-200'
                                  : isUrgent
                                  ? 'bg-red-50 text-red-600 border border-red-200 animate-pulse'
                                  : isDueSoon
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isOverdue
                                ? `${Math.abs(refill.daysRemaining)}d overdue`
                                : refill.isSyrup && refill.daysRemaining === 1
                                ? 'Next Day (Tomorrow)'
                                : isUrgent
                                ? `In ${refill.daysRemaining} days (Urgent)`
                                : isDueSoon
                                ? `In ${refill.daysRemaining} days`
                                : 'Stock Healthy'}
                            </span>
                          </td>

                          {/* 1-Click WhatsApp Reminder */}
                          <td className="py-3 px-5 text-right">
                            <button
                              onClick={() => handleSendWhatsApp(refill)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition-all hover:shadow-xs cursor-pointer"
                              title="Send WhatsApp refill alert in Hindi"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>WhatsApp</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column (1/3 width): Village Breakdown & Quick Roster */}
          <div className="space-y-5">
            {/* Village Delivery Coverage Card */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900 font-heading flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  <span>Village Refill Footprint</span>
                </h3>
                {selectedVillage !== 'All' && (
                  <button
                    onClick={() => setSelectedVillage('All')}
                    className="text-[10px] font-semibold text-teal-700 hover:underline"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Patients distributed across 10–20 KM rural radius around Sarfuddinpur
              </p>

              {Object.keys(villageCounts).length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 bg-gray-50 rounded-xl">
                  No village data recorded yet
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(villageCounts).map(([vil, count]) => {
                    const isSelected = selectedVillage === vil;
                    return (
                      <button
                        key={vil}
                        onClick={() => setSelectedVillage(isSelected ? 'All' : vil)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
                            : 'bg-gray-50/70 border-gray-100 text-gray-700 hover:bg-gray-100/70'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>{vil}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-800 text-[11px] font-bold">
                          {count} patient{count > 1 ? 's' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
              <h3 className="text-sm font-bold text-gray-900 font-heading mb-3">Pharmacy Quick Tools</h3>
              <div className="space-y-2.5">
                <button
                  onClick={() => setShowOnboardModal(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-teal-50/80 hover:bg-teal-100 text-teal-900 border border-teal-100 transition-colors cursor-pointer text-left"
                >
                  <div className="p-2 bg-teal-600 text-white rounded-lg">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold flex items-center gap-1">
                      Onboard New Patient <Sparkles className="w-3 h-3 text-amber-500" />
                    </p>
                    <p className="text-[11px] text-teal-700">Add BP, Sugar, Thyroid, Milk supply</p>
                  </div>
                </button>

                <Link
                  href="/medicines"
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-50/80 hover:bg-blue-100 text-blue-900 border border-blue-100 transition-colors text-left"
                >
                  <div className="p-2 bg-blue-600 text-white rounded-lg">
                    <Pill className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Shop Medicine Catalog</p>
                    <p className="text-[11px] text-blue-700">9,259 medicines with MRP &amp; strip rates</p>
                  </div>
                </Link>

                <Link
                  href="/delivery-sheet"
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-50/80 hover:bg-amber-100 text-amber-900 border border-amber-100 transition-colors text-left"
                >
                  <div className="p-2 bg-amber-600 text-white rounded-lg">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Daily Village Delivery PDF</p>
                    <p className="text-[11px] text-amber-700">Print morning manifest for delivery rider</p>
                  </div>
                </Link>

                <Link
                  href="/settings?tab=import"
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-200 transition-colors text-left"
                >
                  <div className="p-2 bg-gray-700 text-white rounded-lg">
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Import from MARG ERP</p>
                    <p className="text-[11px] text-gray-500">Sync Excel inventory, batches &amp; rates</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Enrolled Chronic Patients Mini Roster */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900 font-heading">Enrolled Patients</h3>
                <Link href="/customers" className="text-xs font-semibold text-teal-600 hover:text-teal-700">
                  View all ({customers.length})
                </Link>
              </div>

              {customers.length === 0 ? (
                <div className="text-center py-6 px-3 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                  <Users className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-gray-700">No Patients Enrolled Yet</p>
                </div>
              ) : (
                <div className="space-y-2.5 divide-y divide-gray-50">
                  {customers.slice(0, 5).map((cust) => {
                    const initials = cust.name
                      .split(' ')
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    const village = cust.locality || (cust.address ? cust.address.replace(/गाँव:?\s*/i, '').split(',')[0].trim() : 'Sarfuddinpur');

                    return (
                      <div key={cust.id} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {initials || 'CU'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">{cust.name}</p>
                            <p className="text-[10px] text-gray-400 truncate">
                              📍 {village} • {cust.prescriptions?.length || 0} med(s)
                            </p>
                          </div>
                        </div>
                        {cust.primaryCondition && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                            {cust.primaryCondition}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Onboard Patient Modal */}
        <OnboardPatientModal
          isOpen={showOnboardModal}
          onClose={() => setShowOnboardModal(false)}
          onSuccess={() => loadData()}
        />
      </div>
    </DashboardLayout>
  );
}
