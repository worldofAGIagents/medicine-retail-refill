'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout';
import {
  Settings, Database, MessageSquare, Truck, Bell, Save, CheckCircle2, ShieldCheck, RefreshCw
} from 'lucide-react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  // Settings state
  const [margConfig, setMargConfig] = useState({
    apiGatewayUrl: 'https://api.margerp.com/v2',
    companyCode: 'PHARMA_DELHI_01',
    branchCode: 'HO',
    syncIntervalHours: '6',
    autoDetectChronic: true,
  });

  const [reminderConfig, setReminderConfig] = useState({
    defaultBufferDays: 3,
    whatsappEnabled: true,
    smsFallback: true,
    reminderTime: '09:00',
    hindiTemplate: 'नमस्ते {{name}} जी, आपकी {{medicine}} दवाई {{days}} दिन में समाप्त होने वाली है। घर बैठे डिलीवरी के लिए 1 दबाएँ या REFILL लिखकर भेजें।',
    englishTemplate: 'Dear {{name}}, your {{medicine}} supply will finish in {{days}} days. To get free doorstep delivery, reply YES to confirm.',
  });

  const [pharmacyInfo, setPharmacyInfo] = useState({
    name: 'Apollo Lifeline Pharmacy',
    dlNumber: 'DL-20B/12345/2022',
    gstin: '07AAAAA0000A1Z5',
    phone: '+91 98765 43210',
    address: 'Shop 14, Main Market, Sector 18, Noida, UP - 201301',
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 font-heading">Settings & Integrations</h1>
            <p className="text-sm text-gray-500">Configure MARG ERP sync, auto-refill triggers, and WhatsApp notifications</p>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl shadow-sm transition-colors"
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Saved Successfully!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All Settings</span>
              </>
            )}
          </button>
        </div>

        {/* 1. Pharmacy Profile */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-heading">Pharmacy Retailer Profile</h2>
              <p className="text-xs text-gray-500">Details printed on delivery slips and customer communications</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Pharmacy / Chemist Name</label>
              <input
                type="text"
                value={pharmacyInfo.name}
                onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, name: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Drug License (DL) Number</label>
              <input
                type="text"
                value={pharmacyInfo.dlNumber}
                onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, dlNumber: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">GSTIN</label>
              <input
                type="text"
                value={pharmacyInfo.gstin}
                onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, gstin: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Helpdesk Phone / WhatsApp</label>
              <input
                type="text"
                value={pharmacyInfo.phone}
                onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, phone: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Store Address</label>
              <input
                type="text"
                value={pharmacyInfo.address}
                onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, address: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. MARG ERP Integration */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 font-heading">MARG ERP Gateway Configuration</h2>
                <p className="text-xs text-gray-500">Connect to your local MARG server or Cloud API gateway</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Live Gateway Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">MARG API URL / IP</label>
              <input
                type="text"
                value={margConfig.apiGatewayUrl}
                onChange={(e) => setMargConfig({ ...margConfig, apiGatewayUrl: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Company Code (MARG)</label>
              <input
                type="text"
                value={margConfig.companyCode}
                onChange={(e) => setMargConfig({ ...margConfig, companyCode: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Auto-Sync Frequency</label>
              <select
                value={margConfig.syncIntervalHours}
                onChange={(e) => setMargConfig({ ...margConfig, syncIntervalHours: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
              >
                <option value="1">Every 1 hour</option>
                <option value="3">Every 3 hours</option>
                <option value="6">Every 6 hours (Recommended)</option>
                <option value="12">Twice daily</option>
                <option value="24">Daily (Midnight)</option>
              </select>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={margConfig.autoDetectChronic}
                onChange={(e) => setMargConfig({ ...margConfig, autoDetectChronic: e.target.checked })}
                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
              />
              <span className="text-xs font-medium text-gray-700">
                Auto-detect chronic salts during import (Metformin, Amlodipine, Telmisartan, Thyroxine, etc.)
              </span>
            </label>

            <button
              type="button"
              onClick={() => alert('MARG ERP Connection Test: Successful! Ping response: 28ms')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Test Connection
            </button>
          </div>
        </div>

        {/* 3. Refill Calculation & Buffer Rules */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-heading">Refill Calculation & Delivery Buffer</h2>
              <p className="text-xs text-gray-500">Fine-tune how many days before medicine ends to dispatch reminders</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Default Reminder Buffer (Days before stock runs out)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={reminderConfig.defaultBufferDays}
                  onChange={(e) => setReminderConfig({ ...reminderConfig, defaultBufferDays: Number(e.target.value) })}
                  className="w-24 px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                />
                <span className="text-xs text-gray-500">
                  Recommended: <strong>3 days</strong> (Allows 1 day for confirmation + 1 day packing + 1 day delivery)
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Daily Reminder Dispatch Time
              </label>
              <input
                type="time"
                value={reminderConfig.reminderTime}
                onChange={(e) => setReminderConfig({ ...reminderConfig, reminderTime: e.target.value })}
                className="w-40 px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* 4. WhatsApp & SMS Notification Templates */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-heading">WhatsApp & SMS Message Templates</h2>
              <p className="text-xs text-gray-500">Automated reminder texts sent to patients via WhatsApp Business API</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Hindi WhatsApp Template
              </label>
              <textarea
                rows={2}
                value={reminderConfig.hindiTemplate}
                onChange={(e) => setReminderConfig({ ...reminderConfig, hindiTemplate: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                English WhatsApp Template
              </label>
              <textarea
                rows={2}
                value={reminderConfig.englishTemplate}
                onChange={(e) => setReminderConfig({ ...reminderConfig, englishTemplate: e.target.value })}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none font-sans"
              />
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderConfig.whatsappEnabled}
                  onChange={(e) => setReminderConfig({ ...reminderConfig, whatsappEnabled: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
                <span className="text-xs font-medium text-gray-700">Enable WhatsApp Notifications</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderConfig.smsFallback}
                  onChange={(e) => setReminderConfig({ ...reminderConfig, smsFallback: e.target.checked })}
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
                <span className="text-xs font-medium text-gray-700">Send SMS fallback if WhatsApp undelivered</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
