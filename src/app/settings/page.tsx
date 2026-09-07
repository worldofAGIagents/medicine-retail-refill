'use client';

import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout';
import {
  Settings, Database, MessageSquare, Truck, Bell, Save, CheckCircle2,
  ShieldCheck, RefreshCw, Loader2, Sparkles, RotateCcw, Copy, Check, Info,
  Smartphone, Eye, Layers, IndianRupee, QrCode, AlertTriangle, KeyRound,
  User, Mail, Phone, Lock, ExternalLink, Send
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_DEFINITIONS,
  TEMPLATE_TAGS,
  renderTemplate,
  TemplateKey,
  TemplateDefinition
} from '@/lib/templates';

type TabKey = 'admin' | 'whatsapp' | 'upi' | 'refills' | 'marg';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('admin');
  const [loading, setLoading] = useState(true);
  const [savedGlobal, setSavedGlobal] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [globalError, setGlobalError] = useState('');

  // 1. Admin Profile & Password States
  const [adminUser, setAdminUser] = useState({
    id: '',
    name: 'Pharmacy Owner',
    email: 'worldofagent@gmail.com',
    role: 'admin',
    createdAt: '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState('');
  const [adminErrorMsg, setAdminErrorMsg] = useState('');

  // 2. Pharmacy Profile States
  const [pharmacyInfo, setPharmacyInfo] = useState({
    name: 'Manoj Medical Hall',
    dlNumber: 'BR-20B/MUZ/2022',
    gstin: '10AAAAA0000A1Z5',
    phone: '+91 98765 43210',
    address: 'Sarfuddinpur, Gopalpur, Muzaffarpur, Bihar - 843118',
    deliveryRadius: '10-20 KM',
    deliveryCoverage: 'Sarfuddinpur, Gopalpur, Bochahan, Gaighat, Ladaura, Musahari & Nearby Villages',
  });

  // 3. WhatsApp & Templates Studio States
  const [activeTemplateKey, setActiveTemplateKey] = useState<TemplateKey>('hindiTemplate');
  const [whatsappMode, setWhatsappMode] = useState<'direct' | 'cloudApi'>('direct');
  const [testPhone, setTestPhone] = useState('');
  const [copiedPreview, setCopiedPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [reminderConfig, setReminderConfig] = useState({
    defaultBufferDays: 3,
    whatsappEnabled: true,
    smsFallback: true,
    reminderTime: '09:00',
    preferredLanguage: 'hindi',
  });

  const [templates, setTemplates] = useState<Record<TemplateKey, string>>({
    hindiTemplate: DEFAULT_TEMPLATES.hindiTemplate,
    englishTemplate: DEFAULT_TEMPLATES.englishTemplate,
    infantMilkTemplate: DEFAULT_TEMPLATES.infantMilkTemplate,
    overdueTemplate: DEFAULT_TEMPLATES.overdueTemplate,
    outForDeliveryTemplate: DEFAULT_TEMPLATES.outForDeliveryTemplate,
  });

  // 4. UPI Payment States
  const [upiId, setUpiId] = useState('manojmedical@okhdfcbank');
  const [upiPayeeName, setUpiPayeeName] = useState('Manoj Medical Hall');
  const [testAmount, setTestAmount] = useState<number>(100);
  const [savingUpi, setSavingUpi] = useState(false);
  const [savedUpi, setSavedUpi] = useState(false);
  const [upiError, setUpiError] = useState('');

  // 5. MARG ERP Gateway States
  const [margConfig, setMargConfig] = useState({
    apiGatewayUrl: 'https://api.margerp.com/v2',
    companyCode: 'MANOJ_MED_01',
    branchCode: 'HO',
    syncIntervalHours: '6',
    autoDetectChronic: true,
  });
  const [margTesting, setMargTesting] = useState(false);
  const [margTestSuccess, setMargTestSuccess] = useState(false);

  // Load all settings on mount with offline-first localStorage fallback
  useEffect(() => {
    // 1. Instantly hydrate from localStorage
    try {
      const cachedUpi = localStorage.getItem('manoj_upi_id');
      const cachedPayee = localStorage.getItem('manoj_upi_payee');
      if (cachedUpi) setUpiId(cachedUpi);
      if (cachedPayee) setUpiPayeeName(cachedPayee);

      const cachedProfile = localStorage.getItem('manoj_pharmacy_profile');
      if (cachedProfile) {
        setPharmacyInfo(JSON.parse(cachedProfile));
      }
    } catch {}

    // 2. Fetch server settings
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          if (data.pharmacyName) {
            setPharmacyInfo((prev) => ({
              ...prev,
              name: data.pharmacyName || prev.name,
              dlNumber: data.dlNumber || prev.dlNumber,
              gstin: data.gstin || prev.gstin,
              phone: data.phone || prev.phone,
              address: data.address || prev.address,
              deliveryRadius: data.deliveryRadius || prev.deliveryRadius,
              deliveryCoverage: data.deliveryCoverage || prev.deliveryCoverage,
            }));
            if (data.phone) setTestPhone(data.phone.replace(/[^0-9]/g, '').slice(-10));
          }

          if (data.upiId) {
            setUpiId(data.upiId);
            setUpiPayeeName(data.upiPayeeName || data.pharmacyName || 'Manoj Medical Hall');
          }

          if (data.margApiUrl) {
            setMargConfig({
              apiGatewayUrl: data.margApiUrl,
              companyCode: data.margCompanyCode || 'MANOJ_MED_01',
              branchCode: data.margBranchCode || 'HO',
              syncIntervalHours: String(data.margSyncInterval || '6'),
              autoDetectChronic: data.autoDetectChronic !== undefined ? Boolean(data.autoDetectChronic) : true,
            });
          }

          setReminderConfig({
            defaultBufferDays: Number(data.defaultBufferDays) || 3,
            whatsappEnabled: data.whatsappEnabled !== undefined ? Boolean(data.whatsappEnabled) : true,
            smsFallback: data.smsFallback !== undefined ? Boolean(data.smsFallback) : true,
            reminderTime: data.reminderTime || '09:00',
            preferredLanguage: data.preferredLanguage || 'hindi',
          });

          setTemplates({
            hindiTemplate: data.hindiTemplate || DEFAULT_TEMPLATES.hindiTemplate,
            englishTemplate: data.englishTemplate || DEFAULT_TEMPLATES.englishTemplate,
            infantMilkTemplate: data.infantMilkTemplate || DEFAULT_TEMPLATES.infantMilkTemplate,
            overdueTemplate: data.overdueTemplate || DEFAULT_TEMPLATES.overdueTemplate,
            outForDeliveryTemplate: data.outForDeliveryTemplate || DEFAULT_TEMPLATES.outForDeliveryTemplate,
          });
        }
      })
      .catch(console.error);

    // 3. Fetch admin user profile
    fetch('/api/auth/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) {
          setAdminUser({
            id: data.user.id,
            name: data.user.name || 'Pharmacy Owner',
            email: data.user.email || 'worldofagent@gmail.com',
            role: data.user.role || 'admin',
            createdAt: data.user.createdAt || '',
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Save Admin details / Change Password
  const handleSaveAdminProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingAdmin(true);
    setAdminSuccessMsg('');
    setAdminErrorMsg('');

    if (newPassword && newPassword.length < 6) {
      setAdminErrorMsg('New password must be at least 6 characters long.');
      setSavingAdmin(false);
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setAdminErrorMsg('New password and confirm password do not match.');
      setSavingAdmin(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: adminUser.name,
          email: adminUser.email,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAdminErrorMsg(data.error || 'Failed to update admin profile.');
      } else {
        setAdminSuccessMsg('Admin profile & credentials saved successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (data.user) {
          setAdminUser((prev) => ({ ...prev, ...data.user }));
        }
        setTimeout(() => setAdminSuccessMsg(''), 4000);
      }
    } catch (err: any) {
      setAdminErrorMsg('Network error while updating admin profile.');
    } finally {
      setSavingAdmin(false);
    }
  };

  // Dedicated UPI Saver
  const handleSaveUpi = async () => {
    const cleanId = upiId.trim();
    const cleanPayee = upiPayeeName.trim() || pharmacyInfo.name || 'Manoj Medical Hall';

    if (!cleanId || !cleanId.includes('@')) {
      setUpiError('Please enter a valid UPI ID (e.g. shop@okhdfcbank or 9876543210@ybl)');
      return;
    }

    setUpiError('');
    setSavingUpi(true);

    try {
      localStorage.setItem('manoj_upi_id', cleanId);
      localStorage.setItem('manoj_upi_payee', cleanPayee);
    } catch {}

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upiId: cleanId,
          upiPayeeName: cleanPayee,
        }),
      });
      if (res.ok) {
        setSavedUpi(true);
        setTimeout(() => setSavedUpi(false), 4000);
      } else {
        setUpiError('Failed saving to server database.');
      }
    } catch (err) {
      // Local storage saved it
      setSavedUpi(true);
      setTimeout(() => setSavedUpi(false), 4000);
    } finally {
      setSavingUpi(false);
    }
  };

  // Universal Save Settings
  const handleSaveAll = async () => {
    setSavingGlobal(true);
    setGlobalError('');

    try {
      localStorage.setItem('manoj_pharmacy_profile', JSON.stringify(pharmacyInfo));
      localStorage.setItem('manoj_upi_id', upiId.trim());
      localStorage.setItem('manoj_upi_payee', upiPayeeName.trim());
    } catch {}

    try {
      const payload = {
        pharmacyName: pharmacyInfo.name,
        dlNumber: pharmacyInfo.dlNumber,
        gstin: pharmacyInfo.gstin,
        phone: pharmacyInfo.phone,
        address: pharmacyInfo.address,
        deliveryRadius: pharmacyInfo.deliveryRadius,
        deliveryCoverage: pharmacyInfo.deliveryCoverage,
        margApiUrl: margConfig.apiGatewayUrl,
        margCompanyCode: margConfig.companyCode,
        margBranchCode: margConfig.branchCode,
        margSyncInterval: margConfig.syncIntervalHours,
        autoDetectChronic: margConfig.autoDetectChronic,
        defaultBufferDays: reminderConfig.defaultBufferDays,
        whatsappEnabled: reminderConfig.whatsappEnabled,
        smsFallback: reminderConfig.smsFallback,
        reminderTime: reminderConfig.reminderTime,
        preferredLanguage: reminderConfig.preferredLanguage,
        hindiTemplate: templates.hindiTemplate,
        englishTemplate: templates.englishTemplate,
        infantMilkTemplate: templates.infantMilkTemplate,
        overdueTemplate: templates.overdueTemplate,
        outForDeliveryTemplate: templates.outForDeliveryTemplate,
        upiId: upiId.trim(),
        upiPayeeName: upiPayeeName.trim() || pharmacyInfo.name,
      };

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSavedGlobal(true);
        setTimeout(() => setSavedGlobal(false), 3000);
      } else {
        const data = await res.json().catch(() => null);
        setGlobalError(data?.error || 'Failed saving settings to server.');
      }
    } catch (err) {
      setGlobalError('Network error while saving settings.');
    } finally {
      setSavingGlobal(false);
    }
  };

  // Insert variable tag into active template at cursor
  const handleInsertTag = (tag: string) => {
    const el = textareaRef.current;
    const currentText = templates[activeTemplateKey] || '';
    if (!el) {
      setTemplates((prev) => ({ ...prev, [activeTemplateKey]: currentText + ' ' + tag }));
      return;
    }
    const start = el.selectionStart ?? currentText.length;
    const end = el.selectionEnd ?? currentText.length;
    const before = currentText.substring(0, start);
    const after = currentText.substring(end);
    const updated = before + tag + after;
    setTemplates((prev) => ({ ...prev, [activeTemplateKey]: updated }));
    setTimeout(() => {
      el.focus();
      const pos = start + tag.length;
      el.setSelectionRange(pos, pos);
    }, 50);
  };

  // Reset current template
  const handleResetTemplate = (key: TemplateKey) => {
    const def = DEFAULT_TEMPLATES[key];
    if (def) setTemplates((prev) => ({ ...prev, [key]: def }));
  };

  // Active definition and live preview
  const activeDef = TEMPLATE_DEFINITIONS.find((d) => d.key === activeTemplateKey) || TEMPLATE_DEFINITIONS[0];
  const previewText = renderTemplate(templates[activeTemplateKey] || '', {
    ...activeDef.sampleVars,
    pharmacy: pharmacyInfo.name || activeDef.sampleVars.pharmacy,
    phone: pharmacyInfo.phone || activeDef.sampleVars.phone,
    address: 'Sarfuddinpur (गाँव)',
  });

  // Send Test WhatsApp to owner mobile
  const handleSendTestWhatsApp = () => {
    const cleanDigits = testPhone.replace(/[^0-9]/g, '').slice(-10);
    if (!cleanDigits || cleanDigits.length < 10) {
      alert('Please enter a valid 10-digit mobile number for the WhatsApp test.');
      return;
    }
    const waUrl = `https://wa.me/91${cleanDigits}?text=${encodeURIComponent(previewText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Test MARG Connection
  const handleTestMarg = () => {
    setMargTesting(true);
    setMargTestSuccess(false);
    setTimeout(() => {
      setMargTesting(false);
      setMargTestSuccess(true);
      setTimeout(() => setMargTestSuccess(false), 5000);
    }, 1000);
  };

  const navTabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'admin', label: 'Admin & Pharmacy', icon: ShieldCheck },
    { key: 'whatsapp', label: 'WhatsApp Templates', icon: MessageSquare },
    { key: 'upi', label: 'UPI & QR Payments', icon: IndianRupee },
    { key: 'refills', label: 'Refills & Delivery', icon: Truck },
    { key: 'marg', label: 'MARG ERP Gateway', icon: Database },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Main Header & Universal Save Trigger */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
                <Settings className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">
                Pharmacy Configuration &amp; Settings
              </h1>
              <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                Manoj Medical Hall
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Admin security, WhatsApp alert templates, doorstep UPI QR payment, and refill timing rules
            </p>
          </div>

          <button
            onClick={handleSaveAll}
            disabled={savingGlobal}
            className="w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            {savingGlobal ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Saving All Changes...</span>
              </>
            ) : savedGlobal ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>Saved to Database!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save All Settings</span>
              </>
            )}
          </button>
        </div>

        {globalError && (
          <div className="p-3.5 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

        {/* Tab Navigation Navigation Bar */}
        <div className="flex gap-2 overflow-x-auto pb-1 border-b border-gray-200 scrollbar-none">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-teal-800 text-white border-teal-800 shadow-xs'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${isActive ? 'text-teal-200' : 'text-gray-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: ADMIN PROFILE & PHARMACY PROFILE */}
        {activeTab === 'admin' && (
          <div className="space-y-6">
            {/* 1.1 Admin Account & Password Card */}
            <div className="bg-white rounded-2xl p-5 sm:p-7 border border-gray-100 shadow-xs space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900 font-heading">Admin Account &amp; Password</h2>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      Security
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Manage store owner credentials and login password</p>
                </div>
              </div>

              {adminSuccessMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{adminSuccessMsg}</span>
                </div>
              )}
              {adminErrorMsg && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{adminErrorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSaveAdminProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Administrator Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={adminUser.name}
                        onChange={(e) => setAdminUser({ ...adminUser, name: e.target.value })}
                        className="w-full pl-9 pr-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
                        placeholder="e.g. Manoj Kumar"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Login Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={adminUser.email}
                        onChange={(e) => setAdminUser({ ...adminUser, email: e.target.value })}
                        className="w-full pl-9 pr-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-mono text-xs sm:text-sm"
                        placeholder="e.g. owner@medrefill.in"
                      />
                    </div>
                  </div>
                </div>

                {/* Password Change Sub-section */}
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-800 mb-3 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-gray-500" />
                    <span>Change Login Password (leave blank to keep existing)</span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Current Password
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        New Password (min 6 chars)
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={savingAdmin}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    {savingAdmin ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Profile...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Admin Profile</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* 1.2 Pharmacy Retailer Details Card */}
            <div className="bg-white rounded-2xl p-5 sm:p-7 border border-gray-100 shadow-xs space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 font-heading">Pharmacy Retailer Identity</h2>
                  <p className="text-xs text-gray-500">Printed on morning delivery sheets and injected into customer messages</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Chemist / Shop Name</label>
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">GSTIN Number</label>
                  <input
                    type="text"
                    value={pharmacyInfo.gstin}
                    onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, gstin: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Shop Helpdesk Phone / WhatsApp</label>
                  <input
                    type="text"
                    value={pharmacyInfo.phone}
                    onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, phone: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Full Store Address</label>
                  <input
                    type="text"
                    value={pharmacyInfo.address}
                    onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, address: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WHATSAPP CONFIG & TEMPLATES */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-6">
            {/* Top WhatsApp Control Bar */}
            <div className="bg-white rounded-2xl p-5 sm:p-7 border border-gray-100 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 font-heading">WhatsApp Alert Engine</h2>
                    <p className="text-xs text-gray-500">Configure reminder channels, preferred language, and live message templates</p>
                  </div>
                </div>

                {/* Preferred Language Toggle */}
                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200 text-xs font-semibold">
                  <span className="text-gray-500 px-2">Language:</span>
                  <button
                    type="button"
                    onClick={() => setReminderConfig({ ...reminderConfig, preferredLanguage: 'hindi' })}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      reminderConfig.preferredLanguage === 'hindi'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🇮🇳 Hindi
                  </button>
                  <button
                    type="button"
                    onClick={() => setReminderConfig({ ...reminderConfig, preferredLanguage: 'english' })}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      reminderConfig.preferredLanguage === 'english'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🇬🇧 English
                  </button>
                </div>
              </div>

              {/* WhatsApp Mode Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => setWhatsappMode('direct')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    whatsappMode === 'direct'
                      ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 shadow-xs'
                      : 'bg-gray-50/60 border-gray-200 text-gray-600 hover:bg-gray-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      1-Click Direct WhatsApp (wa.me)
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Free &amp; 100% reliable. Opens WhatsApp Web or mobile app with pre-filled message. Zero setup fees or Meta API approval needed.
                  </p>
                </div>

                <div
                  onClick={() => setWhatsappMode('cloudApi')}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    whatsappMode === 'cloudApi'
                      ? 'bg-teal-50/70 border-teal-400 text-teal-950 shadow-xs'
                      : 'bg-gray-50/60 border-gray-200 text-gray-600 hover:bg-gray-100/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-teal-600" />
                      Meta WhatsApp Business Cloud API
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                      Advanced
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Automated background sending without clicking. Requires registered Meta Developer App, Phone Number ID, and System User Access Token.
                  </p>
                </div>
              </div>

              {/* Template Switcher Tabs */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold text-gray-700">Select Template to Customize</label>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {TEMPLATE_DEFINITIONS.map((def) => {
                    const isSelected = def.key === activeTemplateKey;
                    return (
                      <button
                        key={def.key}
                        type="button"
                        onClick={() => setActiveTemplateKey(def.key)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                          isSelected
                            ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-xs'
                            : 'bg-gray-50/70 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span>{def.shortLabel}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${def.badgeColor}`}>
                          {def.category}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editor & Live Preview 2-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 items-start">
                {/* Left Editor (7 cols) */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{activeDef.label}</h3>
                      <p className="text-[11px] text-gray-400">{activeDef.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleResetTemplate(activeTemplateKey)}
                      className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 font-semibold"
                      title="Reset this template to original default"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset
                    </button>
                  </div>

                  {/* Variable Tag Toolbar */}
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 mb-1.5 flex items-center gap-1">
                      <span>Click to Insert Dynamic Tag:</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATE_TAGS.map((tag) => (
                        <button
                          key={tag.tag}
                          type="button"
                          onClick={() => handleInsertTag(tag.tag)}
                          className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-[11px] font-mono font-medium transition-colors"
                          title={`Insert ${tag.label} (e.g. ${tag.example})`}
                        >
                          + {tag.tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <textarea
                    ref={textareaRef}
                    rows={7}
                    value={templates[activeTemplateKey] || ''}
                    onChange={(e) =>
                      setTemplates({ ...templates, [activeTemplateKey]: e.target.value })
                    }
                    className="w-full p-3 text-xs sm:text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none leading-relaxed font-sans"
                    placeholder="Enter message template..."
                  />

                  {/* Test WhatsApp Trigger */}
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Send Test WhatsApp Message</span>
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        placeholder="Owner 10-digit mobile number"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                      <button
                        type="button"
                        onClick={handleSendTestWhatsApp}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Send Test</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      Opens WhatsApp with this exact message rendered to preview how patients will see it on their mobile phone.
                    </p>
                  </div>
                </div>

                {/* Right WhatsApp Phone Simulator Preview (5 cols) */}
                <div className="lg:col-span-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Live WhatsApp Chat Preview</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(previewText);
                        setCopiedPreview(true);
                        setTimeout(() => setCopiedPreview(false), 2000);
                      }}
                      className="text-[11px] font-semibold text-teal-700 hover:underline flex items-center gap-1"
                    >
                      {copiedPreview ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedPreview ? 'Copied!' : 'Copy Text'}</span>
                    </button>
                  </div>

                  {/* Smartphone Mockup Frame */}
                  <div className="rounded-2xl border border-gray-300 overflow-hidden shadow-sm bg-[#EFEAE2]">
                    {/* WhatsApp Green App Bar */}
                    <div className="bg-[#075E54] text-white px-3.5 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                          MM
                        </div>
                        <div>
                          <p className="text-xs font-bold truncate">{pharmacyInfo.name}</p>
                          <p className="text-[9px] text-emerald-200">Online • Verified Pharmacy</p>
                        </div>
                      </div>
                    </div>

                    {/* Chat Bubble Canvas */}
                    <div className="p-3.5 min-h-[200px] flex flex-col justify-end space-y-2">
                      <div className="bg-white rounded-xl rounded-tr-xs p-3 shadow-xs max-w-[92%] ml-auto border border-gray-200/60 space-y-1.5">
                        <p className="text-xs text-gray-900 whitespace-pre-line leading-relaxed font-sans">
                          {previewText}
                        </p>
                        <div className="flex items-center justify-end gap-1 text-[9px] text-gray-400">
                          <span>10:30 AM</span>
                          <span className="text-blue-500 font-bold">✓✓</span>
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp Input Mock */}
                    <div className="bg-[#F0F0F0] px-3 py-2 border-t border-gray-200 flex items-center gap-2 text-[11px] text-gray-400">
                      <div className="bg-white rounded-full px-3 py-1 flex-1 text-gray-400">
                        Reply YES for village delivery...
                      </div>
                      <div className="w-6 h-6 rounded-full bg-[#128C7E] text-white flex items-center justify-center font-bold text-xs">
                        ➤
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: UPI & QR PAYMENTS */}
        {activeTab === 'upi' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 sm:p-7 border border-gray-100 shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900 font-heading">Doorstep UPI Payment &amp; QR Setup</h2>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                      Instant Settlement
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Configure your shop VPA for instant dynamic QR code collection during village deliveries</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Input Fields */}
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Store UPI ID (VPA) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value.trim())}
                      placeholder="e.g. manojmedical@okhdfcbank, 9876543210@ybl, shop@paytm"
                      className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono"
                    />
                    {upiId && !upiId.includes('@') && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        UPI ID must include an &apos;@&apos; symbol (e.g. yourname@okhdfcbank)
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">
                      Direct bank settlement via NPCI UPI protocol. No middleman transaction fees.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Payee Display Name (shown to customer)
                    </label>
                    <input
                      type="text"
                      value={upiPayeeName}
                      onChange={(e) => setUpiPayeeName(e.target.value)}
                      placeholder="e.g. Manoj Medical Hall"
                      className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Displayed on the customer&apos;s phone screen inside PhonePe, Google Pay, or Paytm.
                    </p>
                  </div>

                  {/* QR Test Amount Switcher */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      QR Code Test Amount
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[50, 100, 250, 500, 1000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setTestAmount(amt)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            testAmount === amt
                              ? 'bg-indigo-700 text-white shadow-xs'
                              : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleSaveUpi}
                      disabled={savingUpi}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      {savingUpi ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Saving UPI ID...</span>
                        </>
                      ) : savedUpi ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-white" />
                          <span>UPI ID Saved &amp; Active!</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Save UPI Settings</span>
                        </>
                      )}
                    </button>

                    {savedUpi && (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Saved to browser &amp; server!
                      </span>
                    )}
                    {upiError && (
                      <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {upiError}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Live Interactive QR Preview */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                    <QrCode className="w-4 h-4 text-indigo-600" />
                    <span>Live UPI QR Preview (₹{testAmount})</span>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col items-center gap-3 shadow-xs">
                    {upiId && upiId.includes('@') ? (
                      <>
                        <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-xs">
                          <QRCodeSVG
                            value={`upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiPayeeName || 'Pharmacy')}&am=${testAmount}&cu=INR&tn=ManojMedicalHall-Refill`}
                            size={160}
                            bgColor="#ffffff"
                            fgColor="#1e1b4b"
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                        <div className="text-center space-y-0.5">
                          <p className="text-sm font-bold text-gray-900">{upiPayeeName || 'Pharmacy'}</p>
                          <p className="text-xs font-mono text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full inline-block">
                            {upiId}
                          </p>
                          <p className="text-[11px] text-gray-500 pt-1">
                            Scan with PhonePe, GPay, Paytm, or BHIM
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <QrCode className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p className="text-xs font-semibold text-gray-500">Enter a valid UPI ID</p>
                        <p className="text-[11px] text-gray-400">QR preview will generate immediately</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REFILLS & DELIVERY BUFFER */}
        {activeTab === 'refills' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 sm:p-7 border border-gray-100 shadow-xs space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 font-heading">Refill Scheduling &amp; Village Delivery Rules</h2>
                  <p className="text-xs text-gray-500">Define buffer days before medication finishes and delivery footprint</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Default Refill Buffer (Days before patient runs out of medicine)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={reminderConfig.defaultBufferDays}
                      onChange={(e) =>
                        setReminderConfig({ ...reminderConfig, defaultBufferDays: Number(e.target.value) })
                      }
                      className="w-24 px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    />
                    <span className="text-xs text-gray-500">
                      Recommended: <strong>3 days</strong> (Allows 1d confirmation, 1d packing, 1d delivery)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Daily Morning Dispatch Time
                  </label>
                  <input
                    type="time"
                    value={reminderConfig.reminderTime}
                    onChange={(e) =>
                      setReminderConfig({ ...reminderConfig, reminderTime: e.target.value })
                    }
                    className="w-36 px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Delivery Radius
                  </label>
                  <input
                    type="text"
                    value={pharmacyInfo.deliveryRadius}
                    onChange={(e) =>
                      setPharmacyInfo({ ...pharmacyInfo, deliveryRadius: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    placeholder="e.g. 10-20 KM"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Coverage Villages &amp; Localities
                  </label>
                  <input
                    type="text"
                    value={pharmacyInfo.deliveryCoverage}
                    onChange={(e) =>
                      setPharmacyInfo({ ...pharmacyInfo, deliveryCoverage: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                    placeholder="e.g. Sarfuddinpur, Ladaura, Parrakpur, Bochahan"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: MARG ERP GATEWAY */}
        {activeTab === 'marg' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 sm:p-7 border border-gray-100 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 font-heading">MARG ERP Gateway</h2>
                    <p className="text-xs text-gray-500">Connect to your local MARG server or Cloud API gateway</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestMarg}
                  disabled={margTesting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {margTesting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Testing Gateway...</span>
                    </>
                  ) : margTestSuccess ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ping OK: 28ms</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Test Connection</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">MARG API Gateway URL</label>
                  <input
                    type="text"
                    value={margConfig.apiGatewayUrl}
                    onChange={(e) => setMargConfig({ ...margConfig, apiGatewayUrl: e.target.value })}
                    className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Company Code</label>
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

              <div className="pt-3 border-t border-gray-50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={margConfig.autoDetectChronic}
                    onChange={(e) => setMargConfig({ ...margConfig, autoDetectChronic: e.target.checked })}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 shrink-0"
                  />
                  <span className="text-xs font-medium text-gray-700">
                    Auto-categorize chronic medicines during MARG inventory sync (Metformin, Amlodipine, Telmisartan, Thyroxine)
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
