'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCode, IndianRupee, Copy, Check, Share2, Maximize2, Minimize2,
  Printer, ArrowRight, ShieldCheck, Sparkles, Smartphone, Download,
  Settings, CheckCircle2, RefreshCw
} from 'lucide-react';
import Link from 'next/link';

export default function QuickQrPage() {
  const [amount, setAmount] = useState<string>('150');
  const [note, setNote] = useState<string>('Medicine Refill');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('worldofagent@okhdfcbank');
  const [payeeName, setPayeeName] = useState<string>('Manoj Medical Hall');
  const [copied, setCopied] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [loading, setLoading] = useState(true);

  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const localId = typeof window !== 'undefined' ? localStorage.getItem('manoj_upi_id') : null;
      const localPayee = typeof window !== 'undefined' ? localStorage.getItem('manoj_upi_payee') : null;
      if (localId) setUpiId(localId);
      if (localPayee) setPayeeName(localPayee);
    } catch {}

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.upiId) setUpiId(data.upiId);
        if (data?.upiPayeeName || data?.pharmacyName) {
          setPayeeName(data.upiPayeeName || data.pharmacyName);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const numAmount = parseFloat(amount) || 0;
  const formattedAmount = numAmount > 0 ? numAmount.toFixed(2) : '0.00';
  const cleanUpiId = upiId.trim();

  // NPCI standard UPI link
  const upiLink = `upi://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(payeeName)}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent(note || 'Medicine Bill')}`;

  const addAmount = (delta: number) => {
    const current = parseFloat(amount) || 0;
    const next = Math.max(0, current + delta);
    setAmount(String(next));
  };

  const setExactAmount = (val: number) => {
    setAmount(String(val));
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(upiLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const cleanDigits = customerPhone.replace(/[^0-9]/g, '');
    const recipient = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const msg = `Namaste ${customerName ? customerName + ' ji' : 'Customer'}, your medicine bill from *${payeeName}* is *₹${formattedAmount}*.\n\n👉 Tap link to pay instantly via GPay / PhonePe / Paytm / BHIM:\n${upiLink}\n\nUPI ID: ${cleanUpiId}\nThank you!`;
    const waUrl = recipient
      ? `https://wa.me/${recipient}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      {/* Full Screen Mode for Delivery Boy Scanning */}
      {fullScreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
          <button
            onClick={() => setFullScreen(false)}
            className="absolute top-6 right-6 p-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold flex items-center gap-2"
          >
            <Minimize2 className="w-5 h-5" />
            <span>Close Fullscreen</span>
          </button>

          <div className="max-w-sm w-full space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full uppercase tracking-wider">
                Doorstep UPI Scan
              </span>
              <h2 className="text-xl font-extrabold text-gray-900">{payeeName}</h2>
              <p className="text-xs text-gray-500 font-mono">{cleanUpiId}</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border-4 border-teal-600 shadow-2xl flex justify-center">
              <QRCodeSVG
                value={upiLink}
                size={280}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="space-y-2">
              <div className="text-3xl font-black text-gray-900">
                ₹{formattedAmount}
              </div>
              {note && <p className="text-xs font-medium text-gray-500">{note}</p>}
              <p className="text-[11px] text-gray-400">
                Works with Google Pay, PhonePe, Paytm, BHIM, CRED & any UPI app
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-heading text-gray-900">
                  Instant Dynamic UPI QR Generator
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                  <Sparkles className="w-3 h-3" /> Live
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Type any amount to generate a pre-filled UPI payment QR code instantly for counter or doorstep collection.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>UPI Settings</span>
            </Link>
          </div>
        </div>

        {/* Main 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Controls & Input (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Amount Card */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  1. Enter Bill Amount (₹)
                </label>
                {numAmount > 0 && (
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full">
                    ₹{formattedAmount}
                  </span>
                )}
              </div>

              {/* Large Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-teal-600">
                  <IndianRupee className="w-7 h-7" />
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="w-full pl-12 pr-4 py-4 text-3xl font-black text-gray-900 border-2 border-teal-500/40 rounded-2xl focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 outline-none text-left bg-gray-50/50"
                  min="0"
                  step="1"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Quick Amount Presets
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {[100, 200, 500, 1000, 1500].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setExactAmount(val)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                        numAmount === val
                          ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      ₹{val}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] text-gray-500 font-medium">Add to bill:</span>
                  {[50, 100, 200, 500].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => addAmount(val)}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition-colors"
                    >
                      +₹{val}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAmount('')}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors ml-auto"
                  >
                    Clear (₹0)
                  </button>
                </div>
              </div>
            </div>

            {/* Optional Customer & Note Card */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                2. Customer & Bill Details (Optional for WhatsApp)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Ramesh Sharma"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Mobile Number (for WhatsApp)
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Payment Note / Bill Reference
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Telvas 40mg (2 strips)"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                />
              </div>
            </div>

            {/* Shop Settlement Account Info Card */}
            <div className="bg-gradient-to-r from-teal-50 to-indigo-50 border border-teal-200/80 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-teal-200 flex items-center justify-center text-teal-700 shadow-sm">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">Direct Pharmacy Settlement</p>
                  <p className="text-xs font-mono text-teal-800 font-bold">{cleanUpiId}</p>
                  <p className="text-[11px] text-gray-500">{payeeName}</p>
                </div>
              </div>

              <Link
                href="/settings"
                className="text-xs text-teal-700 hover:text-teal-900 font-bold underline"
              >
                Change UPI
              </Link>
            </div>
          </div>

          {/* Right Column: Live Dynamic QR Display (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div
              ref={qrRef}
              className="bg-white rounded-3xl border-2 border-teal-200/80 p-6 shadow-lg flex flex-col items-center text-center gap-4 relative overflow-hidden"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 border border-teal-200 rounded-full text-xs font-bold text-teal-800">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                <span>NPCI Dynamic UPI QR</span>
              </div>

              {/* QR Code Container */}
              <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm relative group">
                <QRCodeSVG
                  value={upiLink}
                  size={210}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Amount Display */}
              <div className="space-y-1">
                <div className="text-3xl font-black text-gray-900 tracking-tight">
                  ₹{formattedAmount}
                </div>
                <p className="text-xs font-semibold text-gray-700">{payeeName}</p>
                <p className="text-[11px] font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md inline-block">
                  {cleanUpiId}
                </p>
                {note && (
                  <p className="text-xs text-gray-500 italic">“{note}”</p>
                )}
              </div>

              <div className="border-t border-gray-100 w-full pt-3">
                <p className="text-[11px] text-gray-400 font-medium">
                  Scan with Google Pay, PhonePe, Paytm, BHIM, CRED or any banking app
                </p>
              </div>

              {/* Doorstep Action Buttons */}
              <div className="w-full space-y-2 pt-1">
                <button
                  onClick={() => setFullScreen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-700 to-indigo-700 hover:from-teal-800 hover:to-indigo-800 text-white font-bold text-sm shadow-md transition-all"
                >
                  <Maximize2 className="w-4 h-4" />
                  <span>Doorstep Full-Screen Scan</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleShareWhatsApp}
                    disabled={numAmount <= 0}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-40"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>WhatsApp Link</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    disabled={numAmount <= 0}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition-all disabled:opacity-40 border border-gray-200"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-green-700">Link Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-gray-600" />
                        <span>Copy UPI Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Tips for Staff & Delivery Boys */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2 text-xs text-gray-600">
              <p className="font-bold text-gray-900 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-teal-600" />
                Doorstep Delivery Guide:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-gray-600 text-[11px]">
                <li><strong>Customer present:</strong> Tap &ldquo;Doorstep Full-Screen Scan&rdquo; and show phone screen to customer.</li>
                <li><strong>Customer not home / Remote payment:</strong> Tap &ldquo;WhatsApp Link&rdquo; to send the UPI payment request directly to their phone.</li>
                <li><strong>Amount verified:</strong> Customer does not need to type any amount or UPI ID manually; it opens pre-filled in their UPI app.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
