'use client';

import { DashboardLayout } from '@/components/layout';
import React, { useState, useEffect } from 'react';
import {
  Printer, Download, Calendar, Phone, MapPin, CheckCircle2, Clock,
  AlertTriangle, Filter, ChevronRight, Package, UserCheck, Milk, Pill
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
    locality?: string;
    city?: string;
  };
  medicine: {
    id: string;
    name: string;
    genericName: string;
    category: string;
    unitsPerPack: number;
    currentStock: number;
    mrp: number;
  };
  refillCalc: {
    daysRemaining: number;
    urgency: 'overdue' | 'urgent' | 'due_soon' | 'ok' | 'future';
    nextRefillDate: string;
  };
}

export default function DeliverySheetPage() {
  const [refillsList, setRefillsList] = useState<RefillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'today' | 'tomorrow' | 'dayAfter' | 'overdue'>('all');
  const [riderName, setRiderName] = useState('Rahul Verma (Rider #1)');
  const [pharmacyName, setPharmacyName] = useState('MedRefill Chemist & Druggist');
  const [dlNumber, setDlNumber] = useState('DL-20B/12345/2022');
  const [packedItems, setPackedItems] = useState<Record<string, boolean>>({});
  const [deliveredItems, setDeliveredItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load refills
    fetch('/api/refills')
      .then((res) => res.json())
      .then((data) => {
        setRefillsList(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Load settings from DB
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.pharmacyName) setPharmacyName(data.pharmacyName);
        if (data?.dlNumber) setDlNumber(data.dlNumber);
      })
      .catch(() => {});
  }, []);

  const todayDateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Filter items based on days remaining
  const overdueList = refillsList.filter((r) => r.refillCalc?.daysRemaining <= 0);
  const todayList = refillsList.filter((r) => r.refillCalc?.daysRemaining > 0 && r.refillCalc?.daysRemaining <= 1);
  const tomorrowList = refillsList.filter((r) => r.refillCalc?.daysRemaining === 2);
  const dayAfterList = refillsList.filter((r) => r.refillCalc?.daysRemaining === 3);

  // Filter based on active tab
  const displayedItems = refillsList.filter((r) => {
    const days = r.refillCalc?.daysRemaining ?? 99;
    if (activeTab === 'all') return days <= 3; // 3 days window + overdue
    if (activeTab === 'overdue') return days <= 0;
    if (activeTab === 'today') return days > 0 && days <= 1;
    if (activeTab === 'tomorrow') return days === 2;
    if (activeTab === 'dayAfter') return days === 3;
    return true;
  });

  const togglePacked = (id: string) => {
    setPackedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleDelivered = (id: string) => {
    setDeliveredItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePrint = () => {
    window.print();
  };

  // Calculate totals
  const totalAmount = displayedItems.reduce((acc, item) => {
    const packs = Math.ceil(item.lastPurchaseQty / (item.medicine.unitsPerPack || 10));
    return acc + (item.medicine.mrp * packs);
  }, 0);

  const totalPacks = displayedItems.reduce((acc, item) => {
    return acc + Math.ceil(item.lastPurchaseQty / (item.medicine.unitsPerPack || 10));
  }, 0);

  return (
    <DashboardLayout>
      {/* CSS for print layout */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            font-size: 11pt !important;
          }
          aside, header, .no-print {
            display: none !important;
          }
          main {
            margin: 0 !important;
            padding: 0 !important;
          }
          .printable-sheet {
            box-shadow: none !important;
            border: 1px solid #000 !important;
            padding: 12px !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #333 !important;
            padding: 6px 8px !important;
          }
        }
      `}</style>

      <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-6">
        
        {/* ACTION BAR (Hidden in print) */}
        <div className="no-print bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl font-bold font-heading text-gray-900 flex items-center gap-2">
              <Printer className="w-5 h-5 text-teal-600" />
              Daily Pharmacist Delivery Plan &amp; PDF Sheet
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Generate, preview, and print the daily chronic refill preparation schedule for riders and pharmacists
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Printer size={16} /> Print / Save as PDF
            </button>
          </div>
        </div>

        {/* TIME-WINDOW FILTER TABS (Hidden in print) */}
        <div className="no-print flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'all'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Complete 3-Day Plan ({refillsList.filter((r) => r.refillCalc?.daysRemaining <= 3).length})
          </button>

          <button
            onClick={() => setActiveTab('today')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'today'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-amber-700 hover:bg-amber-50'
            }`}
          >
            Today / 1 Day Left ({todayList.length})
          </button>

          <button
            onClick={() => setActiveTab('tomorrow')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'tomorrow'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-blue-700 hover:bg-blue-50'
            }`}
          >
            Tomorrow / 2 Days ({tomorrowList.length})
          </button>

          <button
            onClick={() => setActiveTab('dayAfter')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'dayAfter'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-indigo-700 hover:bg-indigo-50'
            }`}
          >
            Day After / 3 Days ({dayAfterList.length})
          </button>

          <button
            onClick={() => setActiveTab('overdue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeTab === 'overdue'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-red-700 hover:bg-red-50'
            }`}
          >
            Overdue Deliveries ({overdueList.length})
          </button>
        </div>

        {/* ---------------- THE PRINTABLE A4 SHEET ---------------- */}
        <div className="printable-sheet bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* Pharmacy & Sheet Header */}
          <div className="border-b-2 border-gray-800 pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight uppercase">
                  {pharmacyName}
                </h2>
                <p className="text-xs text-gray-600 font-medium">
                  Shop 14-16, Commercial Center, Sector 18, Noida • DL No: <strong>{dlNumber}</strong> • GSTIN: 07AAAAA0000A1Z5
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="inline-block px-3 py-1 bg-teal-800 text-white text-xs font-bold rounded uppercase tracking-wider">
                  Daily Delivery Run-Sheet
                </span>
                <p className="text-xs text-gray-800 font-bold mt-1">Date: {todayDateStr}</p>
              </div>
            </div>

            {/* Rider & Shift Info Bar */}
            <div className="mt-4 pt-3 border-t border-gray-200 flex flex-wrap justify-between items-center text-xs text-gray-700 gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900">Assigned Delivery Rider:</span>
                <input
                  type="text"
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                  className="border-b border-gray-400 font-semibold text-gray-900 bg-transparent px-1 focus:outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <span className="font-bold text-gray-900">Shift:</span> Morning Batch (09:00 AM - 02:00 PM)
              </div>
              <div>
                <span className="font-bold text-gray-900">Filter View:</span> {activeTab.toUpperCase()}
              </div>
            </div>
          </div>

          {/* TABLE OF MEDICINE DELIVERIES */}
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading daily delivery sheet...</div>
          ) : displayedItems.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="font-bold text-gray-700">No scheduled deliveries for this time window</p>
              <p className="text-xs text-gray-400">Choose &quot;Complete 3-Day Plan&quot; to view all upcoming refills</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-xs border border-gray-300">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 font-bold text-gray-900 uppercase">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Patient &amp; Phone</th>
                    <th className="py-2.5 px-3">Delivery Address &amp; Locality</th>
                    <th className="py-2.5 px-3">Item &amp; Packaging Size</th>
                    <th className="py-2.5 px-3 text-center">Qty to Deliver</th>
                    <th className="py-2.5 px-3 text-right">Collect (₹)</th>
                    <th className="py-2.5 px-3 text-center">Stock Status</th>
                    <th className="py-2.5 px-2 text-center w-16">Packed</th>
                    <th className="py-2.5 px-2 text-center w-16">Delivered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {displayedItems.map((item, idx) => {
                    const days = item.refillCalc?.daysRemaining ?? 0;
                    const packs = Math.ceil(item.lastPurchaseQty / (item.medicine.unitsPerPack || 10));
                    const itemBill = item.medicine.mrp * packs;
                    const isMilk = item.medicine.category === 'Infant Milk';
                    const isPacked = packedItems[item.id] || false;
                    const isDelivered = deliveredItems[item.id] || false;

                    return (
                      <tr
                        key={item.id}
                        className={`${
                          isDelivered
                            ? 'bg-gray-50 text-gray-400 line-through'
                            : days <= 0
                            ? 'bg-red-50/40'
                            : days <= 1
                            ? 'bg-amber-50/40'
                            : 'hover:bg-gray-50/50'
                        }`}
                      >
                        <td className="py-2 px-3 text-center font-bold text-gray-700">{idx + 1}</td>
                        
                        {/* Patient Name & Phone */}
                        <td className="py-2 px-3">
                          <p className="font-bold text-gray-900">{item.customer.name}</p>
                          <p className="text-[11px] text-gray-600 font-mono">{item.customer.phone}</p>
                          <span className={`inline-block text-[10px] font-bold uppercase px-1.5 py-0.2 rounded mt-0.5 ${
                            days <= 0 ? 'bg-red-100 text-red-800' : days <= 1 ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-800'
                          }`}>
                            {days <= 0 ? 'Overdue' : days === 1 ? 'Due Today' : `${days} days left`}
                          </span>
                        </td>

                        {/* Address */}
                        <td className="py-2 px-3 max-w-xs">
                          <p className="text-gray-800 font-medium">
                            {item.customer.address || `${item.customer.locality || 'Sector 18'}, ${item.customer.city || 'Noida'}`}
                          </p>
                        </td>

                        {/* Item & Packaging */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            {isMilk ? <Milk className="w-3.5 h-3.5 text-purple-700 shrink-0" /> : <Pill className="w-3.5 h-3.5 text-teal-700 shrink-0" />}
                            <span className="font-bold text-gray-900">{item.medicine.name}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5 font-medium">
                            Pack: {item.customPackaging || (isMilk ? '400g Tin' : `${item.medicine.unitsPerPack} tabs/strip`)} • Usage: {item.dailyDosage} {item.unitType === 'grams' ? 'g/day' : 'tab/day'}
                          </p>
                        </td>

                        {/* Qty to Deliver */}
                        <td className="py-2 px-3 text-center">
                          <span className="font-bold text-gray-900">
                            {packs} {isMilk ? (packs === 1 ? 'Tin' : 'Tins') : (packs === 1 ? 'Strip' : 'Strips')}
                          </span>
                          <p className="text-[10px] text-gray-500">
                            ({item.lastPurchaseQty} {item.unitType || 'tabs'})
                          </p>
                        </td>

                        {/* Collect (₹) */}
                        <td className="py-2 px-3 text-right font-extrabold text-gray-900 text-sm">
                          ₹{itemBill.toLocaleString('en-IN')}
                        </td>

                        {/* Stock In Store */}
                        <td className="py-2 px-3 text-center">
                          {item.medicine.currentStock >= item.lastPurchaseQty ? (
                            <span className="text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                              In Stock ({item.medicine.currentStock})
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                              Low Stock ({item.medicine.currentStock})
                            </span>
                          )}
                        </td>

                        {/* Packed Checkbox */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isPacked}
                            onChange={() => togglePacked(item.id)}
                            className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                        </td>

                        {/* Delivered Checkbox */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isDelivered}
                            onChange={() => toggleDelivered(item.id)}
                            className="w-4 h-4 rounded text-green-600 focus:ring-green-500 cursor-pointer"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* FINANCIAL & RUNNER COLLECTION TALLY BOX */}
          <div className="border border-gray-300 rounded-xl p-4 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-600 uppercase tracking-wider font-bold">Preparation Summary</p>
              <div className="flex gap-4 text-xs font-semibold text-gray-800">
                <span>Total Deliveries: <strong>{displayedItems.length} Patients</strong></span>
                <span>•</span>
                <span>Total Packs to Pick: <strong>{totalPacks} Strips / Tins</strong></span>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs text-gray-600 uppercase tracking-wider font-bold">Total Cash / UPI to Collect</p>
              <p className="text-2xl font-black text-gray-900 font-heading">
                ₹{totalAmount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* SIGNATURE BLOCKS FOR PHARMACIST & DELIVERY EXECUTIVE */}
          <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 text-xs text-gray-800">
            <div className="border-t border-gray-400 pt-2 text-center">
              <p className="font-bold text-gray-900">Dispensed &amp; Verified By (Registered Pharmacist)</p>
              <p className="text-[10px] text-gray-500">Sign &amp; Pharmacy Stamp</p>
            </div>
            <div className="border-t border-gray-400 pt-2 text-center">
              <p className="font-bold text-gray-900">Cash Received &amp; Reconciled By (Delivery Executive)</p>
              <p className="text-[10px] text-gray-500">Rider Signature &amp; Date</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
