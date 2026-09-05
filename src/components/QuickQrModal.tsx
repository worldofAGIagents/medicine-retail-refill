'use client';

import React, { useState, useEffect, useId } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X, QrCode, IndianRupee, Copy, Check, Share2, Maximize2, Minimize2,
  Sparkles, ShieldCheck, AlertCircle, Phone
} from 'lucide-react';

interface QuickQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAmount?: number | string;
  initialNote?: string;
  customerName?: string;
  customerPhone?: string;
}

export function QuickQrModal({
  isOpen,
  onClose,
  initialAmount = '',
  initialNote = 'Medicine Bill',
  customerName = '',
  customerPhone = '',
}: QuickQrModalProps) {
  const [amount, setAmount] = useState<string>(initialAmount ? String(initialAmount) : '');
  const [note, setNote] = useState<string>(initialNote);
  const [phone, setPhone] = useState<string>(customerPhone);
  const [upiId, setUpiId] = useState<string>('');
  const [payeeName, setPayeeName] = useState<string>('Manoj Medical Hall');
  const [copied, setCopied] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Sync initial props
  useEffect(() => {
    if (initialAmount) setAmount(String(initialAmount));
    if (initialNote) setNote(initialNote);
    if (customerPhone) setPhone(customerPhone);
  }, [initialAmount, initialNote, customerPhone, isOpen]);

  // Load shop UPI settings
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
        if (data?.upiId) {
          setUpiId(data.upiId);
        } else {
          setUpiId((prev) => prev || 'worldofagent@okhdfcbank');
        }
        if (data?.upiPayeeName || data?.pharmacyName) {
          setPayeeName(data.upiPayeeName || data.pharmacyName);
        }
        setLoadingSettings(false);
      })
      .catch(() => {
        setUpiId((prev) => prev || 'worldofagent@okhdfcbank');
        setLoadingSettings(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(upiLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const cleanDigits = phone.replace(/[^0-9]/g, '');
    const recipient = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const msg = `Namaste ${customerName ? customerName + ' ji' : 'Customer'}, your medicine refill bill from *${payeeName}* is *₹${formattedAmount}*.\n\n👉 Click to pay instantly via UPI (GPay/PhonePe/Paytm/BHIM):\n${upiLink}\n\nUPI ID: ${cleanUpiId}\nThank you!`;
    const waUrl = recipient
      ? `https://wa.me/${recipient}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className={`bg-white rounded-3xl shadow-2xl border border-gray-100 w-full transition-all overflow-hidden flex flex-col ${
          fullScreen ? 'fixed inset-3 sm:inset-6 max-w-none max-h-none' : 'max-w-md max-h-[92vh]'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-teal-700 via-teal-800 to-indigo-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-md">
              <QrCode className="w-4 h-4 text-teal-200" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                Instant UPI QR Code
                <span className="bg-teal-500/30 text-teal-200 text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider">
                  Live
                </span>
              </h3>
              <p className="text-[11px] text-teal-200/80 truncate max-w-[220px]">
                {payeeName} • {cleanUpiId || 'Configuring UPI'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFullScreen(!fullScreen)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-teal-200 hover:text-white transition-colors"
              title={fullScreen ? 'Exit Full Screen' : 'Full Screen Scanning'}
            >
              {fullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-teal-200 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {customerName && (
            <div className="bg-teal-50/70 border border-teal-200/60 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-teal-900 font-medium">
                <span className="text-teal-600 font-normal">Patient:</span>
                <strong>{customerName}</strong>
              </div>
              {phone && (
                <span className="text-teal-700 font-mono text-[11px]">{phone}</span>
              )}
            </div>
          )}

          {/* Amount Input with Quick Presets */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
              Enter Amount (₹)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <IndianRupee className="w-5 h-5 text-teal-700" />
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 sm:py-3 text-2xl font-black text-gray-900 border-2 border-teal-600/30 rounded-2xl focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 outline-none text-center bg-gray-50/50 tracking-tight"
              />
            </div>

            {/* Presets Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {[50, 100, 200, 500, 1000].map((val) => (
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
                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors ml-auto"
              >
                Clear
              </button>
            </div>
          </div>

          {/* QR Display Card */}
          <div className="bg-gradient-to-b from-white to-gray-50 rounded-2xl border-2 border-dashed border-teal-300/80 p-4 flex flex-col items-center justify-center gap-3 relative shadow-inner">
            {numAmount > 0 ? (
              <>
                <div className="p-2.5 bg-white rounded-2xl shadow-md border border-gray-100">
                  <QRCodeSVG
                    value={upiLink}
                    size={fullScreen ? 280 : 190}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div className="text-center space-y-0.5">
                  <div className="inline-flex items-center gap-1 text-xs font-black text-teal-800 bg-teal-100/80 px-3 py-1 rounded-full">
                    <span>Pay Exact: ₹{formattedAmount}</span>
                  </div>
                  <p className="text-[11px] font-mono text-gray-600 pt-1">{cleanUpiId}</p>
                  <p className="text-[10px] text-gray-400">
                    Works on GPay, PhonePe, Paytm, BHIM, CRED & any UPI App
                  </p>
                </div>
              </>
            ) : (
              <div className="py-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto text-teal-600">
                  <QrCode className="w-6 h-6 animate-pulse" />
                </div>
                <p className="text-sm font-bold text-gray-700">Type any amount above</p>
                <p className="text-xs text-gray-400 max-w-[200px] mx-auto">
                  The dynamic UPI QR code will appear automatically with exact amount
                </p>
              </div>
            )}
          </div>

          {/* Optional Bill Note & Phone */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 block mb-1">
                Bill Note / Ref
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Medicine Bill"
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 block mb-1">
                Customer Mobile (for WA)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-teal-500 font-mono"
              />
            </div>
          </div>

          {/* Doorstep Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={handleShareWhatsApp}
              disabled={numAmount <= 0}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Send WhatsApp</span>
            </button>

            <button
              onClick={handleCopyLink}
              disabled={numAmount <= 0}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-gray-200"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-green-700">UPI Link Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-gray-600" />
                  <span>Copy UPI Link</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 text-center pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Instant settlement to registered pharmacy account ({cleanUpiId})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
