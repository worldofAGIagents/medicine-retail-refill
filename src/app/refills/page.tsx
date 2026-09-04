'use client';

import { DashboardLayout } from '@/components/layout';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell, ShoppingBag, Clock, Calendar, CheckCircle2, Phone,
  MapPin, AlertTriangle, MessageCircle, ExternalLink, Milk, Pill,
  Copy, X, Printer, FastForward, Layers, Send, Play, Pause
} from 'lucide-react';

interface RefillItem {
  id: string;
  dailyDosage: number;
  lastPurchaseDate: string;
  lastPurchaseQty: number;
  nextRefillDate: string;
  customPackaging?: string | null;
  unitType?: string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
    address?: string;
    city?: string;
  };
  medicine: {
    id: string;
    name: string;
    genericName: string;
    category: string;
    unitsPerPack: number;
    mrp: number;
  };
  refillCalc: {
    daysRemaining: number;
    urgency: 'overdue' | 'urgent' | 'due_soon' | 'ok' | 'future';
    nextRefillDate: string;
  };
}

interface WhatsAppModalData {
  item: RefillItem;
  waMeUrl: string;
  message: string;
  phone: string;
}

export default function RefillsPage() {
  const [refillsList, setRefillsList] = useState<RefillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [orderCreating, setOrderCreating] = useState<string | null>(null);
  const [whatsappModal, setWhatsappModal] = useState<WhatsAppModalData | null>(null);
  const [copied, setCopied] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Batch Automation Queue states
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchQueue, setBatchQueue] = useState<RefillItem[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchMode, setBatchMode] = useState<'cloudApi' | 'webQueue'>('webQueue');
  const [batchCompleteMsg, setBatchCompleteMsg] = useState('');
  const [pharmacyName, setPharmacyName] = useState('MedRefill Chemist & Druggist');

  const loadRefills = () => {
    setLoading(true);
    fetch('/api/refills')
      .then((res) => res.json())
      .then((data) => {
        setRefillsList(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.pharmacyName) setPharmacyName(data.pharmacyName);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadRefills();
  }, []);

  const filteredRefills = refillsList.filter((r) => {
    if (categoryFilter === 'All') return true;
    const catQuery = categoryFilter.toLowerCase();
    const medCat = r.medicine?.category?.toLowerCase() || '';
    if (catQuery === 'bp') return medCat.includes('bp') || medCat.includes('blood pressure');
    return medCat.includes(catQuery);
  });

  const overdue = filteredRefills.filter((r) => r.refillCalc?.daysRemaining <= 0);
  const dueToday = filteredRefills.filter((r) => r.refillCalc?.daysRemaining > 0 && r.refillCalc?.daysRemaining <= 2);
  const thisWeek = filteredRefills.filter((r) => r.refillCalc?.daysRemaining > 2 && r.refillCalc?.daysRemaining <= 7);
  const upcoming = filteredRefills.filter((r) => r.refillCalc?.daysRemaining > 7);

  // Group by customer to identify bundling opportunities
  const customerMedsCount: Record<string, number> = {};
  refillsList.forEach((r) => {
    const cId = r.customer?.id;
    if (cId) customerMedsCount[cId] = (customerMedsCount[cId] || 0) + 1;
  });

  // REAL WORKABLE WHATSAPP TRIGGER (Single)
  const handleTriggerWhatsApp = async (item: RefillItem) => {
    try {
      const res = await fetch('/api/notifications/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prescriptionId: item.id,
          phone: item.customer.phone,
          customerName: item.customer.name,
          medicineName: item.medicine.name,
          daysRemaining: item.refillCalc.daysRemaining,
          refillDate: item.refillCalc.nextRefillDate,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setWhatsappModal({
          item,
          waMeUrl: data.waMeUrl,
          message: data.message,
          phone: data.phone,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenWhatsAppDirect = (waMeUrl: string) => {
    window.open(waMeUrl, '_blank', 'noopener,noreferrer');
    setToastMsg('Opened WhatsApp! Message is pre-filled and ready to send.');
    setTimeout(() => setToastMsg(''), 4000);
    setWhatsappModal(null);
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // SNOOZE / POSTPONE REFILL
  const handleSnoozeRefill = async (item: RefillItem, daysToAdd: number) => {
    try {
      const baseDate = new Date(item.nextRefillDate || Date.now());
      baseDate.setDate(baseDate.getDate() + daysToAdd);

      const res = await fetch(`/api/prescriptions/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nextRefillDate: baseDate.toISOString(),
        }),
      });

      if (res.ok) {
        setToastMsg(`Refill postponed by ${daysToAdd} days for ${item.customer.name}.`);
        setTimeout(() => setToastMsg(''), 4000);
        loadRefills();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // OPEN 1-CLICK BATCH RUNNER
  const handleOpenBatchRunner = () => {
    const targets = [...overdue, ...dueToday];
    if (targets.length === 0) {
      setToastMsg('No overdue or urgent refills pending!');
      setTimeout(() => setToastMsg(''), 3000);
      return;
    }
    setBatchQueue(targets);
    setBatchIndex(0);
    setBatchCompleteMsg('');
    setShowBatchModal(true);
  };

  // RUN BATCH DISPATCH
  const handleRunBatchCloudApi = async () => {
    setBatchRunning(true);
    try {
      const payload = batchQueue.map((item) => ({
        prescriptionId: item.id,
        phone: item.customer.phone,
        customerName: item.customer.name,
        medicineName: item.medicine.name,
        daysRemaining: item.refillCalc.daysRemaining,
        refillDate: item.refillCalc.nextRefillDate,
      }));

      const res = await fetch('/api/notifications/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });

      const data = await res.json();
      if (data.success) {
        setBatchCompleteMsg(`Dispatched background reminders to ${data.total} patients via WhatsApp Business API!`);
        setTimeout(() => {
          setShowBatchModal(false);
          loadRefills();
        }, 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBatchRunning(false);
    }
  };

  const handleNextWebQueue = () => {
    if (batchIndex < batchQueue.length) {
      const current = batchQueue[batchIndex];
      const encodedMsg = encodeURIComponent(
        `नमस्ते ${current.customer.name} जी, आपकी दवाई ${current.medicine.name} ${current.refillCalc.daysRemaining <= 0 ? 'समाप्त हो चुकी है' : `${current.refillCalc.daysRemaining} दिन में समाप्त होने वाली है`}। क्या हम फ्री होम डिलीवरी भेज दें? रिप्लाई में YES भेजें। - ${pharmacyName}`
      );
      const cleanDigits = current.customer.phone.replace(/[^0-9]/g, '');
      const phone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
      const url = `https://wa.me/${phone}?text=${encodedMsg}`;

      window.open(url, '_blank', 'noopener,noreferrer');

      if (batchIndex + 1 >= batchQueue.length) {
        setBatchCompleteMsg('All queue reminders sent successfully!');
      } else {
        setBatchIndex((prev) => prev + 1);
      }
    }
  };

  const handleCreateOrder = async (item: RefillItem) => {
    setOrderCreating(item.id);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: item.customer.id,
          totalAmount: item.medicine.mrp * Math.ceil(item.lastPurchaseQty / (item.medicine.unitsPerPack || 10)),
          status: 'preparing',
          deliveryAddress: item.customer.address || `${item.customer.city || 'Local Delivery'}`,
          notes: `Auto-refill order for ${item.medicine.name}`,
          items: [
            {
              medicineName: item.medicine.name,
              medicineId: item.medicine.id,
              quantity: item.lastPurchaseQty,
              unitPrice: item.medicine.mrp,
              totalPrice: item.medicine.mrp * Math.ceil(item.lastPurchaseQty / (item.medicine.unitsPerPack || 10)),
            },
          ],
        }),
      });

      if (res.ok) {
        setToastMsg(`Doorstep delivery order created for ${item.customer.name}! View in Orders tab.`);
        setTimeout(() => setToastMsg(''), 5000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setOrderCreating(null);
    }
  };

  const RefillCard = ({ item, borderClass }: { item: RefillItem; borderClass: string }) => {
    const initials = item.customer.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    const days = item.refillCalc?.daysRemaining ?? 0;
    const refillDate = new Date(item.refillCalc.nextRefillDate);
    const isMilk = item.medicine?.category === 'Infant Milk';
    const medsCountForPatient = customerMedsCount[item.customer?.id] || 1;

    return (
      <div className={`bg-white border rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs hover:shadow-md transition-shadow ${borderClass}`}>
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-sm shrink-0">
            {initials}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-gray-900 text-base">{item.customer.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                isMilk ? 'bg-purple-100 text-purple-800' : 'bg-blue-50 text-blue-700'
              }`}>
                {item.medicine.category}
              </span>

              {medsCountForPatient > 1 && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Layers size={11} /> Bundle: {medsCountForPatient} Meds for Patient
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-0.5">
              {isMilk ? <Milk className="w-3.5 h-3.5 text-purple-600" /> : <Pill className="w-3.5 h-3.5 text-teal-600" />}
              <p className="text-sm font-semibold text-teal-800">{item.medicine.name}</p>
              {item.customPackaging && (
                <span className="text-[11px] text-gray-500 font-medium">({item.customPackaging})</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500 font-medium">
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3 text-gray-400" /> {item.customer.phone}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-gray-400" /> Refill Date: {refillDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
              <span>•</span>
              <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                days <= 0 ? 'bg-red-100 text-red-700' : days <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {days <= 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
          
          {/* Postpone / Snooze Dropdown */}
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white text-xs">
            <span className="px-2 py-1 text-gray-400 font-medium">Snooze:</span>
            <button
              onClick={() => handleSnoozeRefill(item, 3)}
              title="Customer has extra stock, postpone 3 days"
              className="px-2 py-1.5 hover:bg-gray-100 text-gray-700 font-semibold border-l border-gray-200"
            >
              +3d
            </button>
            <button
              onClick={() => handleSnoozeRefill(item, 7)}
              title="Postpone 7 days"
              className="px-2 py-1.5 hover:bg-gray-100 text-gray-700 font-semibold border-l border-gray-200"
            >
              +7d
            </button>
          </div>

          <button
            onClick={() => handleCreateOrder(item)}
            disabled={orderCreating === item.id}
            className="border border-teal-600 text-teal-700 hover:bg-teal-50 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <ShoppingBag size={14} />
            {orderCreating === item.id ? 'Creating...' : 'Create Order'}
          </button>

          <button
            onClick={() => handleTriggerWhatsApp(item)}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
          >
            <MessageCircle size={14} />
            WhatsApp
          </button>
        </div>
      </div>
    );
  };

  const categories = ['All', 'Diabetes', 'BP', 'Thyroid', 'Cholesterol', 'Infant Milk'];

  return (
    <DashboardLayout>
      <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-gray-900">Refill Alert &amp; Dispatch Center</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Predictive refill tracking, 1-Click WhatsApp automation, and daily delivery sheets
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Daily PDF Sheet Button */}
            <Link
              href="/delivery-sheet"
              className="border border-teal-600 bg-white hover:bg-teal-50 text-teal-700 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors text-center"
            >
              <Printer size={16} /> Print Daily Delivery Plan (PDF)
            </Link>

            {/* 1-Click Batch WhatsApp Button */}
            <button
              onClick={handleOpenBatchRunner}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors text-center"
            >
              <FastForward size={16} /> 1-Click Batch WhatsApp ({overdue.length + dueToday.length})
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                categoryFilter === c
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {toastMsg && (
          <div className="bg-teal-50 border border-teal-200 text-teal-800 p-4 rounded-xl flex items-center gap-2 text-sm font-medium animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
            {toastMsg}
          </div>
        )}

        {/* Urgency Stat Pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-red-50 border border-red-200/60 rounded-2xl p-4">
            <span className="text-red-700 text-xs font-bold uppercase tracking-wider">Overdue</span>
            <p className="text-3xl font-bold text-red-900 mt-1 font-heading">{overdue.length}</p>
            <span className="text-xs text-red-600 mt-0.5 block">Stock finished!</span>
          </div>
          <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4">
            <span className="text-amber-700 text-xs font-bold uppercase tracking-wider">Due in 1-2 Days</span>
            <p className="text-3xl font-bold text-amber-900 mt-1 font-heading">{dueToday.length}</p>
            <span className="text-xs text-amber-600 mt-0.5 block">Deliver before run-out</span>
          </div>
          <div className="bg-blue-50 border border-blue-200/60 rounded-2xl p-4">
            <span className="text-blue-700 text-xs font-bold uppercase tracking-wider">Due This Week</span>
            <p className="text-3xl font-bold text-blue-900 mt-1 font-heading">{thisWeek.length}</p>
            <span className="text-xs text-blue-600 mt-0.5 block">Next 3-7 days</span>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
            <span className="text-gray-700 text-xs font-bold uppercase tracking-wider">Total Active</span>
            <p className="text-3xl font-bold text-gray-900 mt-1 font-heading">{filteredRefills.length}</p>
            <span className="text-xs text-gray-500 mt-0.5 block">Filtered patients</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading refills timeline...</div>
        ) : filteredRefills.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 p-8">
            <Clock className="w-12 h-12 mx-auto text-gray-300 mb-2" />
            <p className="font-semibold text-gray-700">No pending refills for this category</p>
            <p className="text-xs text-gray-400 mt-1">All chronic subscriptions are well supplied!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. OVERDUE SECTION */}
            {overdue.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-600 font-bold text-sm uppercase tracking-wider">
                  <AlertTriangle size={18} />
                  <span>Overdue ({overdue.length}) - Medicines have run out!</span>
                </div>
                <div className="space-y-3">
                  {overdue.map((r) => (
                    <RefillCard key={r.id} item={r} borderClass="border-l-4 border-l-red-500 bg-red-50/20" />
                  ))}
                </div>
              </div>
            )}

            {/* 2. DUE TODAY / URGENT SECTION */}
            {dueToday.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-sm uppercase tracking-wider">
                  <Clock size={18} />
                  <span>Due in 1-2 Days ({dueToday.length}) - Deliver before supply runs out</span>
                </div>
                <div className="space-y-3">
                  {dueToday.map((r) => (
                    <RefillCard key={r.id} item={r} borderClass="border-l-4 border-l-amber-500 bg-amber-50/20" />
                  ))}
                </div>
              </div>
            )}

            {/* 3. DUE THIS WEEK SECTION */}
            {thisWeek.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-700 font-bold text-sm uppercase tracking-wider">
                  <Calendar size={18} />
                  <span>Due This Week ({thisWeek.length})</span>
                </div>
                <div className="space-y-3">
                  {thisWeek.map((r) => (
                    <RefillCard key={r.id} item={r} borderClass="border-l-4 border-l-blue-400" />
                  ))}
                </div>
              </div>
            )}

            {/* 4. UPCOMING SECTION */}
            {upcoming.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700 font-bold text-sm uppercase tracking-wider">
                  <CheckCircle2 size={18} />
                  <span>Upcoming Refills ({upcoming.length})</span>
                </div>
                <div className="space-y-3">
                  {upcoming.map((r) => (
                    <RefillCard key={r.id} item={r} borderClass="border-l-4 border-l-green-400" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------------- 1-CLICK BATCH WHATSAPP AUTOMATION MODAL ---------------- */}
        {showBatchModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-5 animate-scaleUp max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                    <FastForward className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-gray-900">1-Click Automated Batch WhatsApp</h3>
                    <p className="text-xs text-gray-500">Queue of {batchQueue.length} Overdue &amp; Due Patients</p>
                  </div>
                </div>
                <button onClick={() => setShowBatchModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X size={20} />
                </button>
              </div>

              {/* MODE SELECTION: Zero-Cost Assisted Queue vs Cloud API */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-gray-100 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setBatchMode('webQueue')}
                  className={`py-2 px-2 rounded-lg transition-colors text-center ${
                    batchMode === 'webQueue' ? 'bg-white text-green-800 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  🚀 Rapid Web Queue (Free)
                </button>
                <button
                  type="button"
                  onClick={() => setBatchMode('cloudApi')}
                  className={`py-2 px-2 rounded-lg transition-colors text-center ${
                    batchMode === 'cloudApi' ? 'bg-white text-green-800 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  ⚡ Cloud API (1-Click)
                </button>
              </div>

              {batchCompleteMsg ? (
                <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-2xl text-xs font-bold text-center">
                  ✅ {batchCompleteMsg}
                </div>
              ) : batchMode === 'cloudApi' ? (
                <div className="space-y-3 bg-teal-50/50 p-4 rounded-2xl border border-teal-100">
                  <p className="text-xs text-teal-900 font-semibold leading-relaxed">
                    With WhatsApp Business Cloud API (or Twilio/WATI), you can fire reminders to all {batchQueue.length} patients simultaneously in the background with zero phone interaction.
                  </p>
                  <button
                    onClick={handleRunBatchCloudApi}
                    disabled={batchRunning}
                    className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Send size={16} /> {batchRunning ? 'Dispatching Batch...' : `Send to All ${batchQueue.length} Patients Now`}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
                    <div className="flex justify-between text-xs text-gray-700 font-semibold">
                      <span>Queue Progress:</span>
                      <span>Patient {batchIndex + 1} of {batchQueue.length}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-green-600 h-2 transition-all duration-300"
                        style={{ width: `${((batchIndex + 1) / batchQueue.length) * 100}%` }}
                      />
                    </div>

                    {batchQueue[batchIndex] && (
                      <div className="pt-2">
                        <p className="text-xs text-gray-500">Current Target:</p>
                        <p className="text-sm font-bold text-gray-900">{batchQueue[batchIndex].customer.name} ({batchQueue[batchIndex].customer.phone})</p>
                        <p className="text-xs text-teal-700 font-medium">Refill: {batchQueue[batchIndex].medicine.name}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleNextWebQueue}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <ExternalLink size={16} /> Open Next Patient Chat &amp; Advance
                    </button>
                  </div>
                </div>
              )}

              {/* Patient List in Queue */}
              <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 border rounded-xl p-2 text-xs">
                {batchQueue.map((item, idx) => (
                  <div key={item.id} className="py-1.5 px-2 flex justify-between items-center text-gray-700">
                    <span>{idx + 1}. {item.customer.name} ({item.medicine.name})</span>
                    <span className="font-bold text-gray-900">{item.refillCalc.daysRemaining <= 0 ? 'Overdue' : `${item.refillCalc.daysRemaining}d`}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- SINGLE WHATSAPP PREVIEW MODAL ---------------- */}
        {whatsappModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 animate-scaleUp max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-green-100 text-green-700 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-gray-900">WhatsApp Refill Message Ready</h3>
                    <p className="text-xs text-gray-500">To: {whatsappModal.item.customer.name} (+{whatsappModal.phone})</p>
                  </div>
                </div>
                <button onClick={() => setWhatsappModal(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              {/* Message Preview in WhatsApp Style Box */}
              <div className="p-4 bg-[#EFEAE2] rounded-2xl border border-gray-200">
                <div className="bg-white rounded-xl p-3.5 shadow-xs max-w-md ml-auto border border-gray-100 space-y-2">
                  <p className="text-xs text-gray-800 whitespace-pre-line leading-relaxed">
                    {whatsappModal.message}
                  </p>
                  <span className="text-[10px] text-gray-400 block text-right">Just now • WhatsApp</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                <span>Refill Target: <strong>{new Date(whatsappModal.item.refillCalc.nextRefillDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong></span>
                <span>Delivery: <strong>Free Doorstep</strong></span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                <button
                  onClick={() => handleCopyMessage(whatsappModal.message)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5"
                >
                  <Copy size={15} /> {copied ? 'Copied!' : 'Copy Text'}
                </button>

                <button
                  onClick={() => handleOpenWhatsAppDirect(whatsappModal.waMeUrl)}
                  className="flex-1 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <ExternalLink size={16} /> Open in WhatsApp Web / App
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
