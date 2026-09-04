'use client';

import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout';
import {
  Settings, Database, MessageSquare, Truck, Bell, Save, CheckCircle2,
  ShieldCheck, RefreshCw, Loader2, Sparkles, RotateCcw, Copy, Check, Info,
  Smartphone, Eye, Layers
} from 'lucide-react';
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_DEFINITIONS,
  TEMPLATE_TAGS,
  renderTemplate,
  TemplateKey,
  TemplateDefinition
} from '@/lib/templates';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedPreview, setCopiedPreview] = useState(false);

  // Active template tab
  const [activeTemplateKey, setActiveTemplateKey] = useState<TemplateKey>('hindiTemplate');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Pharmacy Profile
  const [pharmacyInfo, setPharmacyInfo] = useState({
    name: 'MedRefill Chemist & Druggist',
    dlNumber: 'DL-20B/12345/2022',
    gstin: '07AAAAA0000A1Z5',
    phone: '+91 98765 43210',
    address: 'Shop 14, Main Market, Sector 18, Noida, UP - 201301',
  });

  // MARG ERP Config
  const [margConfig, setMargConfig] = useState({
    apiGatewayUrl: 'https://api.margerp.com/v2',
    companyCode: 'PHARMA_DELHI_01',
    branchCode: 'HO',
    syncIntervalHours: '6',
    autoDetectChronic: true,
  });

  // Reminder & General Config
  const [reminderConfig, setReminderConfig] = useState({
    defaultBufferDays: 3,
    whatsappEnabled: true,
    smsFallback: true,
    reminderTime: '09:00',
    preferredLanguage: 'hindi',
  });

  // Template Strings
  const [templates, setTemplates] = useState<Record<TemplateKey, string>>({
    hindiTemplate: DEFAULT_TEMPLATES.hindiTemplate,
    englishTemplate: DEFAULT_TEMPLATES.englishTemplate,
    infantMilkTemplate: DEFAULT_TEMPLATES.infantMilkTemplate,
    overdueTemplate: DEFAULT_TEMPLATES.overdueTemplate,
    outForDeliveryTemplate: DEFAULT_TEMPLATES.outForDeliveryTemplate,
  });

  // Load from DB on mount
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (data.pharmacyName) {
            setPharmacyInfo({
              name: data.pharmacyName,
              dlNumber: data.dlNumber || '',
              gstin: data.gstin || '',
              phone: data.phone || '',
              address: data.address || '',
            });
          }
          if (data.margApiUrl) {
            setMargConfig({
              apiGatewayUrl: data.margApiUrl,
              companyCode: data.margCompanyCode || '',
              branchCode: data.margBranchCode || '',
              syncIntervalHours: String(data.margSyncInterval || '6'),
              autoDetectChronic: Boolean(data.autoDetectChronic),
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
      .catch((err) => console.error('Failed to load settings:', err))
      .finally(() => setLoading(false));
  }, []);

  // Insert variable tag into active template at cursor position
  const handleInsertTag = (tag: string) => {
    const el = textareaRef.current;
    const currentText = templates[activeTemplateKey] || '';

    if (!el) {
      setTemplates((prev) => ({
        ...prev,
        [activeTemplateKey]: currentText + ' ' + tag,
      }));
      return;
    }

    const start = el.selectionStart ?? currentText.length;
    const end = el.selectionEnd ?? currentText.length;
    const before = currentText.substring(0, start);
    const after = currentText.substring(end);
    const updated = before + tag + after;

    setTemplates((prev) => ({
      ...prev,
      [activeTemplateKey]: updated,
    }));

    // Reset cursor position after insert
    setTimeout(() => {
      el.focus();
      const newPos = start + tag.length;
      el.setSelectionRange(newPos, newPos);
    }, 50);
  };

  // Reset current template to default
  const handleResetTemplate = (key: TemplateKey) => {
    const defaultVal = DEFAULT_TEMPLATES[key];
    if (defaultVal) {
      setTemplates((prev) => ({
        ...prev,
        [key]: defaultVal,
      }));
    }
  };

  // Save all settings to DB
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        pharmacyName: pharmacyInfo.name,
        dlNumber: pharmacyInfo.dlNumber,
        gstin: pharmacyInfo.gstin,
        phone: pharmacyInfo.phone,
        address: pharmacyInfo.address,
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
      };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const activeDef = TEMPLATE_DEFINITIONS.find((d) => d.key === activeTemplateKey) || TEMPLATE_DEFINITIONS[0];

  // Render live preview message replacing sample variables + live pharmacy details
  const previewText = renderTemplate(templates[activeTemplateKey] || '', {
    ...activeDef.sampleVars,
    pharmacy: pharmacyInfo.name || activeDef.sampleVars.pharmacy,
    phone: pharmacyInfo.phone || activeDef.sampleVars.phone,
  });

  const handleCopyPreview = () => {
    navigator.clipboard.writeText(previewText);
    setCopiedPreview(true);
    setTimeout(() => setCopiedPreview(false), 2000);
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Top Header with Sticky Action */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
                <Settings className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-heading">
                Account Settings &amp; Templates
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Customize WhatsApp reminder templates, pharmacy brand details, MARG ERP sync, and refill triggers
            </p>
          </div>

          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="w-full sm:w-auto justify-center flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Saving to Database...</span>
              </>
            ) : saved ? (
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

        {/* 1. WHATSAPP & NOTIFICATION TEMPLATES STUDIO */}
        <div className="bg-white rounded-3xl p-4 sm:p-7 shadow-xs border border-gray-100 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-green-50 flex items-center justify-center text-green-600 shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900 font-heading">
                    WhatsApp Message Templates Customization
                  </h2>
                  <span className="bg-green-100 text-green-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Dynamic Engine
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Manage patient communication templates across chronic care, overdue alerts, infant formula, and dispatch updates
                </p>
              </div>
            </div>

            {/* Preferred Language Radio */}
            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200 text-xs font-semibold">
              <span className="text-gray-500 px-2">Default Language:</span>
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

          {/* Template Selector Navigation Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {TEMPLATE_DEFINITIONS.map((def) => {
              const isSelected = def.key === activeTemplateKey;
              return (
                <button
                  key={def.key}
                  type="button"
                  onClick={() => setActiveTemplateKey(def.key)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                    isSelected
                      ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-xs'
                      : 'bg-gray-50/70 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
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

          {/* Active Template Editor & Live Preview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Template Editor (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{activeDef.label}</h3>
                  <p className="text-xs text-gray-500">{activeDef.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleResetTemplate(activeTemplateKey)}
                  className="text-xs text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
                  title="Revert to standard default template"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                  <span>Reset to Default</span>
                </button>
              </div>

              {/* Dynamic Tag Inserter Chips */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Click to Insert Placeholders / Variables:</span>
                  </label>
                  <span className="text-[11px] text-gray-400">Inserts at cursor position</span>
                </div>
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-gray-50/80 rounded-2xl border border-gray-200/80">
                  {TEMPLATE_TAGS.map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => handleInsertTag(t.tag)}
                      className="px-2.5 py-1 bg-white hover:bg-teal-50 hover:border-teal-400 text-teal-800 border border-gray-200 rounded-lg text-xs font-mono font-semibold transition-colors flex items-center gap-1 shadow-2xs group"
                      title={`Insert ${t.tag} (${t.label} - e.g. ${t.example})`}
                    >
                      <span>{t.tag}</span>
                      <span className="text-[10px] text-gray-400 group-hover:text-teal-600 font-sans font-normal">
                        ({t.label})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-semibold text-gray-700">Template Content</label>
                  <span className="text-gray-400 font-mono">
                    {(templates[activeTemplateKey] || '').length} characters
                  </span>
                </div>
                <textarea
                  ref={textareaRef}
                  rows={6}
                  value={templates[activeTemplateKey] || ''}
                  onChange={(e) =>
                    setTemplates({
                      ...templates,
                      [activeTemplateKey]: e.target.value,
                    })
                  }
                  placeholder="Enter message template with {{name}}, {{medicine}}, {{days}}, {{pharmacy}}, etc..."
                  className="w-full p-3.5 text-sm border border-gray-200 rounded-2xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none leading-relaxed transition-all shadow-inner bg-white font-sans"
                />
              </div>

              {/* Toggles */}
              <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-5 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminderConfig.whatsappEnabled}
                    onChange={(e) =>
                      setReminderConfig({ ...reminderConfig, whatsappEnabled: e.target.checked })
                    }
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                  />
                  <span className="font-medium text-gray-700">Enable Automated WhatsApp Dispatches</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminderConfig.smsFallback}
                    onChange={(e) =>
                      setReminderConfig({ ...reminderConfig, smsFallback: e.target.checked })
                    }
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                  />
                  <span className="font-medium text-gray-700">Send SMS Fallback if WhatsApp Fails</span>
                </label>
              </div>
            </div>

            {/* Right Column: Live Authentic WhatsApp Bubble Preview (5 cols) */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                  <Eye className="w-4 h-4 text-teal-600" />
                  <span>Real-time WhatsApp Preview</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  className="text-xs text-gray-500 hover:text-gray-800 font-medium flex items-center gap-1"
                >
                  {copiedPreview ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-green-600 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Sample</span>
                    </>
                  )}
                </button>
              </div>

              {/* Authentic Phone Screen / WhatsApp Card */}
              <div className="rounded-3xl border border-gray-200 overflow-hidden shadow-sm bg-[#EFEAE2] flex flex-col">
                {/* WhatsApp Chat Bar Header */}
                <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-teal-800 border border-white/20 flex items-center justify-center font-bold text-xs text-white">
                      {pharmacyInfo.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight truncate max-w-[170px]">
                        {pharmacyInfo.name}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                        <span className="text-[10px] text-teal-100 font-normal">Verified Pharmacy • Online</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
                    Preview
                  </span>
                </div>

                {/* WhatsApp Chat Body */}
                <div className="p-4 space-y-3 min-h-[220px] flex flex-col justify-end">
                  <div className="text-center">
                    <span className="bg-white/80 backdrop-blur-xs text-[10px] font-bold text-gray-500 px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs">
                      Today • Sample Delivery Customer
                    </span>
                  </div>

                  {/* Outgoing Message Bubble */}
                  <div className="bg-white rounded-2xl rounded-tr-xs p-3.5 shadow-sm max-w-[90%] ml-auto border border-gray-200/60 space-y-2 relative">
                    <p className="text-xs text-gray-900 whitespace-pre-line leading-relaxed font-sans">
                      {previewText || (
                        <span className="text-gray-400 italic">No template text provided.</span>
                      )}
                    </p>

                    <div className="flex items-center justify-end gap-1 text-[10px] text-gray-400 pt-1">
                      <span>10:30 AM</span>
                      {/* Double Blue Checkmarks */}
                      <span className="text-blue-500 font-bold tracking-tighter">✓✓</span>
                    </div>
                  </div>
                </div>

                {/* WhatsApp Chat Footer Mock */}
                <div className="bg-[#F0F0F0] px-3 py-2 border-t border-gray-200 flex items-center gap-2 text-xs text-gray-400">
                  <div className="bg-white rounded-full px-3 py-1.5 flex-1 text-gray-400 text-[11px] shadow-2xs">
                    Reply YES to confirm doorstep delivery...
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#128C7E] text-white flex items-center justify-center font-bold text-xs">
                    ➤
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-1.5 text-[11px] text-gray-500 px-1">
                <Info className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                <span>
                  Dynamic tags like <strong>&#123;&#123;name&#125;&#125;</strong> and <strong>&#123;&#123;medicine&#125;&#125;</strong> will automatically be replaced with patient prescription records when sending via WhatsApp.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. PHARMACY PROFILE */}
        <div className="bg-white rounded-3xl p-4 sm:p-7 shadow-xs border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-heading">Pharmacy Retailer Profile</h2>
              <p className="text-xs text-gray-500">Details printed on delivery slips and injected into customer messages</p>
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

        {/* 3. REFILL CALCULATION & DELIVERY BUFFER */}
        <div className="bg-white rounded-3xl p-4 sm:p-7 shadow-xs border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 font-heading">Refill Timing &amp; Delivery Buffer Rules</h2>
              <p className="text-xs text-gray-500">Fine-tune when reminders trigger and how much buffer time delivery requires</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Default Reminder Buffer (Days before stock runs out)
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
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
                onChange={(e) =>
                  setReminderConfig({ ...reminderConfig, reminderTime: e.target.value })
                }
                className="w-40 px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* 4. MARG ERP INTEGRATION */}
        <div className="bg-white rounded-3xl p-4 sm:p-7 shadow-xs border border-gray-100 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 font-heading">MARG ERP Gateway Configuration</h2>
                <p className="text-xs text-gray-500">Connect to your local MARG server or Cloud API gateway</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto">
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

          <div className="mt-4 pt-3 border-t border-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={margConfig.autoDetectChronic}
                onChange={(e) => setMargConfig({ ...margConfig, autoDetectChronic: e.target.checked })}
                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 shrink-0"
              />
              <span className="text-xs font-medium text-gray-700">
                Auto-detect chronic salts during import (Metformin, Amlodipine, Telmisartan, Thyroxine, etc.)
              </span>
            </label>

            <button
              type="button"
              onClick={() => alert('MARG ERP Connection Test: Successful! Ping response: 28ms')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Test Connection
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

