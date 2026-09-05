'use client';

import { DashboardLayout } from '@/components/layout';
import React, { useState, useEffect } from 'react';
import {
  Printer, Download, Calendar, Phone, MapPin, CheckCircle2, Clock,
  AlertTriangle, Filter, ChevronRight, Package, UserCheck, Milk, Pill,
  QrCode, Send, Share2, Copy, Check, X, ExternalLink, MessageSquare,
  Navigation
} from 'lucide-react';
import { QuickQrModal } from '@/components/QuickQrModal';

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
    altPhone?: string | null;
    address?: string | null;
    locality?: string | null;
    city?: string | null;
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
  const [pharmacyName, setPharmacyName] = useState('Manoj Medical Hall');
  const [address, setAddress] = useState('Sarfuddinpur, Gopalpur, Muzaffarpur, Bihar - 843118');
  const [dlNumber, setDlNumber] = useState('BR-20B/MUZ/2022');
  const [riderName, setRiderName] = useState('Rider #1 (Village Route)');
  const [riderPhone, setRiderPhone] = useState('');
  const [shopPhone, setShopPhone] = useState('+91 98765 43210');
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [copiedRoute, setCopiedRoute] = useState(false);
  const [selectedVillage, setSelectedVillage] = useState<string>('all');
  const [packedItems, setPackedItems] = useState<Record<string, boolean>>({});
  const [deliveredItems, setDeliveredItems] = useState<Record<string, boolean>>({});
  const [qrModalItem, setQrModalItem] = useState<{
    amount: number;
    name: string;
    phone: string;
    note: string;
  } | null>(null);

  useEffect(() => {
    try {
      const savedRider = localStorage.getItem('manoj_rider_name');
      const savedPhone = localStorage.getItem('manoj_rider_phone');
      if (savedRider) setRiderName(savedRider);
      if (savedPhone) setRiderPhone(savedPhone);
    } catch {}

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
        if (data?.address) setAddress(data.address);
        if (data?.dlNumber) setDlNumber(data.dlNumber);
        if (data?.phone) setShopPhone(data.phone);
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

  // Extract list of unique villages in refills
  const villageList = Array.from(
    new Set(
      refillsList
        .map((r) => r.customer.locality || (r.customer.address ? r.customer.address.split(',')[0].trim() : ''))
        .filter(Boolean)
    )
  );

  // Filter based on active tab & village
  const displayedItems = refillsList.filter((r) => {
    const days = r.refillCalc?.daysRemaining ?? 99;
    let matchTab = true;
    if (activeTab === 'all') matchTab = days <= 3; // 3 days window + overdue
    else if (activeTab === 'overdue') matchTab = days <= 0;
    else if (activeTab === 'today') matchTab = days > 0 && days <= 1;
    else if (activeTab === 'tomorrow') matchTab = days === 2;
    else if (activeTab === 'dayAfter') matchTab = days === 3;

    if (!matchTab) return false;
    if (selectedVillage !== 'all') {
      const v = (r.customer.locality || r.customer.address || '').toLowerCase();
      return v.includes(selectedVillage.toLowerCase());
    }
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

  // Generate WhatsApp message formatted for rider delivery run
  const generateRiderRouteMessage = (items: RefillItem[], village: string, rider: string) => {
    const totalColl = items.reduce((acc, item) => {
      const packs = Math.ceil(item.lastPurchaseQty / (item.medicine.unitsPerPack || 10));
      return acc + item.medicine.mrp * packs;
    }, 0);

    const routeLabel = village === 'all' ? 'सभी गाँव (All 10–20 KM Villages)' : `गाँव: ${village}`;

    let msg = `🚴 *${pharmacyName} - डिलीवरी रूट शीट*\n`;
    msg += `📅 तारीख: ${todayDateStr}\n`;
    msg += `👤 राइडर: ${rider || 'डिलीवरी बॉय'}\n`;
    msg += `📍 रूट: ${routeLabel}\n`;
    msg += `📦 कुल डिलीवरी: ${items.length} मरीज | कुल वसूली: ₹${totalColl.toLocaleString('en-IN')}\n\n`;
    msg += `─────────────────────────\n`;

    items.forEach((item, idx) => {
      const packs = Math.ceil(item.lastPurchaseQty / (item.medicine.unitsPerPack || 10));
      const bill = item.medicine.mrp * packs;
      const isMilk = item.medicine.category === 'Infant Milk';

      msg += `${idx + 1}️⃣ *${item.customer.name}*\n`;
      msg += `📍 पता: ${item.customer.address || (item.customer.locality ? `गाँव: ${item.customer.locality}, मुज़फ़्फ़रपुर` : 'सरफुद्दीनपुर')}\n`;
      msg += `💊 दवाई: ${item.medicine.name} (${packs} ${isMilk ? 'Tin' : 'पत्ता'})\n`;
      msg += `💰 वसूली बिल: ₹${bill} (कैश / UPI)\n`;
      msg += `📞 मरीज फोन: ${item.customer.phone}\n`;
      if (item.customer.altPhone) {
        msg += `👨‍👦 बेटा/परिवार: ${item.customer.altPhone}\n`;
      }
      msg += `\n`;
    });

    msg += `─────────────────────────\n`;
    msg += `⚠️ *राइडर के लिए जरूरी निर्देश*:\n`;
    msg += `1. घर जाने से पहले मरीज या उनके बेटे को फोन करके कन्फर्म कर लें।\n`;
    msg += `2. ऑनलाइन UPI पेमेंट के लिए ग्राहक को डायनामिक QR दिखाएँ:\n`;
    msg += `   👉 https://www.retailink.shop/quick-qr\n`;
    msg += `3. कोई भी परेशानी हो तो तुरंत दुकान पर बात करें: ${shopPhone}\n`;

    return msg;
  };

  const handleSendToRider = () => {
    const cleanPhone = riderPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone) {
      alert('कृपया राइडर का व्हाट्सएप नंबर दर्ज करें (Please enter rider WhatsApp number)');
      return;
    }
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = generateRiderRouteMessage(displayedItems, selectedVillage, riderName);

    try {
      localStorage.setItem('manoj_rider_name', riderName);
      localStorage.setItem('manoj_rider_phone', riderPhone);
    } catch {}

    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleCopyRoute = () => {
    const msg = generateRiderRouteMessage(displayedItems, selectedVillage, riderName);
    navigator.clipboard.writeText(msg);
    setCopiedRoute(true);
    setTimeout(() => setCopiedRoute(false), 2500);
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

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => setShowDispatchModal(true)}
              className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              title="Share this route directly to rider on WhatsApp"
            >
              <Send size={15} /> 📲 Share Route to Rider
            </button>
            <button
              onClick={() => setQrModalItem({
                amount: 0,
                name: '',
                phone: '',
                note: 'Doorstep Collection',
              })}
              className="bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-800 hover:to-indigo-800 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              title="Instant Dynamic UPI QR Generator"
            >
              <QrCode size={15} /> ⚡ QR
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Printer size={15} /> Print PDF
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

        {/* VILLAGE ROUTE CLUSTER FILTER (Hidden in print) */}
        {villageList.length > 0 && (
          <div className="no-print flex items-center justify-between gap-2 flex-wrap bg-white p-3 rounded-xl border border-gray-200 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-700 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                Village Route (10–20 KM):
              </span>
              <button
                onClick={() => setSelectedVillage('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  selectedVillage === 'all'
                    ? 'bg-teal-700 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Villages
              </button>
              {villageList.map((village) => {
                const count = refillsList.filter((r) =>
                  (r.customer.locality || r.customer.address || '').toLowerCase().includes(village.toLowerCase())
                ).length;
                return (
                  <button
                    key={village}
                    onClick={() => setSelectedVillage(village)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all ${
                      selectedVillage === village
                        ? 'bg-teal-700 text-white'
                        : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
                    }`}
                  >
                    {village} ({count})
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowDispatchModal(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-xs shrink-0"
              title="Send active route list to rider WhatsApp"
            >
              <Send size={13} className="text-emerald-600" />
              <span>Send {selectedVillage === 'all' ? 'All Routes' : `${selectedVillage} Route`} to Rider</span>
            </button>
          </div>
        )}

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
                  {address} • DL No: <strong>{dlNumber}</strong> • Delivery Coverage: 10–20 KM Village Radius (Muzaffarpur)
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
                    <th className="py-2.5 px-2 text-center w-16 print:hidden">UPI QR</th>
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
                        
                        {/* Patient Name & Phone + 1-Tap Calling & WhatsApp */}
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-gray-900">{item.customer.name}</p>
                          
                          {/* 1-Tap Direct Call & WhatsApp */}
                          <div className="flex items-center gap-1.5 mt-1">
                            <a
                              href={`tel:${item.customer.phone}`}
                              className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 px-1.5 py-0.5 rounded border border-teal-200 transition-colors"
                              title="Call Patient Directly"
                            >
                              <Phone className="w-3 h-3 text-teal-600" />
                              <span>{item.customer.phone}</span>
                            </a>
                            <a
                              href={`https://wa.me/91${item.customer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                `नमस्ते ${item.customer.name} जी, आपकी दवाई मनोज मेडिकल हॉल (सरफुद्दीनपुर) से डिलीवरी के लिए निकल रही है। कुल बिल: ₹${itemBill}। क्या आप घर पर हैं?`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-1.5 py-0.5 rounded bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-[10px] font-bold transition-colors inline-flex items-center gap-0.5"
                              title="Chat with Patient on WhatsApp"
                            >
                              WA
                            </a>
                          </div>

                          {/* Alternate Family Phone (Son / Caretaker) if available */}
                          {item.customer.altPhone && (
                            <div className="flex items-center gap-1 mt-1">
                              <a
                                href={`tel:${item.customer.altPhone}`}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-200 transition-colors"
                                title="Call Family Member / Son"
                              >
                                <span className="text-[9px] uppercase font-bold text-indigo-500">बेटा/परिवार:</span>
                                <span>{item.customer.altPhone}</span>
                              </a>
                            </div>
                          )}

                          <span className={`inline-block text-[10px] font-bold uppercase px-1.5 py-0.2 rounded mt-1 ${
                            days <= 0 ? 'bg-red-100 text-red-800' : days <= 1 ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-800'
                          }`}>
                            {days <= 0 ? 'Overdue' : days === 1 ? 'Due Today' : `${days} days left`}
                          </span>
                        </td>

                        {/* Address & 1-Tap Google Maps Navigation */}
                        <td className="py-2.5 px-3 max-w-xs">
                          <p className="text-gray-800 font-medium">
                            {item.customer.address || (item.customer.locality ? `गाँव: ${item.customer.locality}, मुज़फ़्फ़रपुर` : 'सरफुद्दीनपुर, मुज़फ़्फ़रपुर')}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {item.customer.locality && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                📍 {item.customer.locality}
                              </span>
                            )}
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                `${item.customer.address || item.customer.locality || 'Sarfuddinpur'}, Muzaffarpur, Bihar`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5 font-medium print:hidden"
                              title="Search Landmark on Google Maps"
                            >
                              <Navigation className="w-2.5 h-2.5" /> मैप देखें
                            </a>
                          </div>
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

                        {/* UPI QR Trigger Button */}
                        <td className="py-2 px-2 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => setQrModalItem({
                              amount: itemBill,
                              name: item.customer.name,
                              phone: item.customer.phone,
                              note: `${item.medicine.name} (${packs} ${isMilk ? 'Tin' : 'Strip'})`,
                            })}
                            className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 hover:text-teal-900 border border-teal-200 transition-colors inline-flex items-center justify-center"
                            title={`Generate ₹${itemBill} UPI QR for ${item.customer.name}`}
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
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

      {/* Dynamic UPI QR Modal for Doorstep Delivery */}
      {qrModalItem && (
        <QuickQrModal
          isOpen={!!qrModalItem}
          onClose={() => setQrModalItem(null)}
          initialAmount={qrModalItem.amount}
          customerName={qrModalItem.name}
          customerPhone={qrModalItem.phone}
          initialNote={qrModalItem.note}
        />
      )}

      {/* Modal: Share Route to Rider via WhatsApp */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-teal-50 to-emerald-50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Send Route to Rider on WhatsApp</h3>
                  <p className="text-xs text-gray-500">
                    {displayedItems.length} Deliveries • {selectedVillage === 'all' ? 'All Villages' : `Village: ${selectedVillage}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDispatchModal(false)}
                className="p-1.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Rider Input Fields */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">राइडर का नाम (Rider Name)</label>
                  <input
                    type="text"
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                    placeholder="e.g. Sonu Kumar"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    राइडर व्हाट्सएप नंबर (Rider WhatsApp) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={riderPhone}
                    onChange={(e) => setRiderPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Route Summary Chips */}
              <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-950">रूट:</span>
                  <span className="bg-white px-2 py-0.5 rounded-md font-bold text-emerald-800 border border-emerald-200">
                    {selectedVillage === 'all' ? 'सभी गाँव (All Villages)' : selectedVillage}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-semibold text-emerald-900">
                  <span>📦 {displayedItems.length} मरीज</span>
                  <span>💰 कुल वसूली: ₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Message Live Preview Box */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-gray-700">व्हाट्सएप संदेश पूर्वावलोकन (WhatsApp Message Preview)</label>
                  <button
                    type="button"
                    onClick={handleCopyRoute}
                    className="text-[11px] font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedRoute ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                    <span>{copiedRoute ? 'Copied!' : 'Copy Text'}</span>
                  </button>
                </div>
                <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-200 font-mono text-[11px] text-gray-800 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                  {generateRiderRouteMessage(displayedItems, selectedVillage, riderName)}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <button
                type="button"
                onClick={handleCopyRoute}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 font-bold text-xs text-gray-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedRoute ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                <span>{copiedRoute ? 'Route Copied!' : 'Copy Route Text'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendToRider}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Send size={16} />
                <span>🟢 Open WhatsApp &amp; Send to Rider</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
