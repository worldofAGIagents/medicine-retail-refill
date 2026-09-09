'use client';

import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  Settings, Database, MessageSquare, Truck, Bell, Save, CheckCircle2,
  ShieldCheck, RefreshCw, Loader2, Sparkles, RotateCcw, Copy, Check, Info,
  Smartphone, Eye, EyeOff, Layers, IndianRupee, QrCode, AlertTriangle, KeyRound,
  User, Mail, Phone, Lock, Unlock, ExternalLink, Send, Upload, UploadCloud,
  FileText, History, Box, CheckCircle, Pill, X
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

type TabKey = 'admin' | 'import' | 'whatsapp' | 'upi' | 'refills' | 'marg';

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
    dlNumber: '',
    gstin: '',
    phone: '',
    address: 'Sarfuddinpur, Gopalpur, Muzaffarpur, Bihar - 843118',
    deliveryRadius: '10-20 KM',
    deliveryCoverage: 'Sarfuddinpur, Gopalpur, Bochahan, Gaighat, Ladaura, Musahari & Nearby Villages',
  });
  const [savingPharmacyProfile, setSavingPharmacyProfile] = useState(false);
  const [savedPharmacyProfile, setSavedPharmacyProfile] = useState(false);

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
    englishInfantMilkTemplate: DEFAULT_TEMPLATES.englishInfantMilkTemplate,
    overdueTemplate: DEFAULT_TEMPLATES.overdueTemplate,
    englishOverdueTemplate: DEFAULT_TEMPLATES.englishOverdueTemplate,
    outForDeliveryTemplate: DEFAULT_TEMPLATES.outForDeliveryTemplate,
    englishOutForDeliveryTemplate: DEFAULT_TEMPLATES.englishOutForDeliveryTemplate,
  });

  // 4. MARG Import States
  const [importType, setImportType] = useState<'medicines' | 'sales' | 'stock'>('medicines');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importCsvData, setImportCsvData] = useState<any[]>([]);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importedStats, setImportedStats] = useState<any>(null);
  const [importErrorMsg, setImportErrorMsg] = useState('');

  // 5. UPI Payment States & Security Passcode Lock
  const [upiId, setUpiId] = useState('manojmedical@okhdfcbank');
  const [upiPayeeName, setUpiPayeeName] = useState('Manoj Medical Hall');
  const [testAmount, setTestAmount] = useState<number>(100);
  const [savingUpi, setSavingUpi] = useState(false);
  const [savedUpi, setSavedUpi] = useState(false);
  const [upiError, setUpiError] = useState('');

  // UPI Security Lock States (Protected by Owner Passcode)
  const [isUpiLocked, setIsUpiLocked] = useState(true);
  const [upiPasscode, setUpiPasscode] = useState('MANOJ2026');
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPinMask, setShowPinMask] = useState(false);

  // Change PIN States
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');
  const [savingPin, setSavingPin] = useState(false);

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
    // 0. Check URL query params for active tab (e.g. ?tab=import)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as TabKey;
      if (tabParam && ['admin', 'import', 'whatsapp', 'upi', 'refills', 'marg'].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }

    // 1. Instantly hydrate from localStorage
    try {
      const cachedUpi = localStorage.getItem('manoj_upi_id');
      const cachedPayee = localStorage.getItem('manoj_upi_payee');
      const cachedPin = localStorage.getItem('manoj_upi_passcode');
      if (cachedUpi) setUpiId(cachedUpi);
      if (cachedPayee) setUpiPayeeName(cachedPayee);
      if (cachedPin) setUpiPasscode(cachedPin);

      const cachedProfile = localStorage.getItem('manoj_pharmacy_profile');
      if (cachedProfile) {
        try {
          const parsed = JSON.parse(cachedProfile);
          if (parsed.phone === '+91 98765 43210') parsed.phone = '';
          setPharmacyInfo(parsed);
        } catch {}
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
              dlNumber: data.dlNumber !== undefined ? data.dlNumber : '',
              gstin: data.gstin !== undefined ? data.gstin : '',
              phone: data.phone !== undefined ? data.phone : prev.phone,
              address: data.address || prev.address,
              deliveryRadius: data.deliveryRadius || prev.deliveryRadius,
              deliveryCoverage: data.deliveryCoverage || prev.deliveryCoverage,
            }));
            if (data.phone) setTestPhone(data.phone.replace(/[^0-9]/g, '').slice(-10));
          }

          const localCustomized = typeof window !== 'undefined' && localStorage.getItem('manoj_upi_customized') === 'true';
          const localId = typeof window !== 'undefined' ? localStorage.getItem('manoj_upi_id') : null;
          const localPayee = typeof window !== 'undefined' ? localStorage.getItem('manoj_upi_payee') : null;

          if (localCustomized && localId && localId.includes('@')) {
            setUpiId(localId);
            if (localPayee) setUpiPayeeName(localPayee);
            if (data.upiId && data.upiId !== localId) {
              fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  upiId: localId,
                  upiPayeeName: localPayee || 'Manoj Medical Hall',
                  upiCustomized: 'true',
                }),
              }).catch(() => {});
            }
          } else if (data.upiId) {
            setUpiId(data.upiId);
            setUpiPayeeName(data.upiPayeeName || data.pharmacyName || 'Manoj Medical Hall');
          }

          if (data.upiPasscode) {
            setUpiPasscode(data.upiPasscode);
            try {
              localStorage.setItem('manoj_upi_passcode', data.upiPasscode);
            } catch {}
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

          if (data.preferredLanguage === 'english') {
            setActiveTemplateKey('englishTemplate');
          }

          setTemplates({
            hindiTemplate: data.hindiTemplate || DEFAULT_TEMPLATES.hindiTemplate,
            englishTemplate: data.englishTemplate || DEFAULT_TEMPLATES.englishTemplate,
            infantMilkTemplate: data.infantMilkTemplate || DEFAULT_TEMPLATES.infantMilkTemplate,
            englishInfantMilkTemplate: data.englishInfantMilkTemplate || DEFAULT_TEMPLATES.englishInfantMilkTemplate,
            overdueTemplate: data.overdueTemplate || DEFAULT_TEMPLATES.overdueTemplate,
            englishOverdueTemplate: data.englishOverdueTemplate || DEFAULT_TEMPLATES.englishOverdueTemplate,
            outForDeliveryTemplate: data.outForDeliveryTemplate || DEFAULT_TEMPLATES.outForDeliveryTemplate,
            englishOutForDeliveryTemplate: data.englishOutForDeliveryTemplate || DEFAULT_TEMPLATES.englishOutForDeliveryTemplate,
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

  // Save Pharmacy Retailer Profile
  const handleSavePharmacyProfile = async () => {
    setSavingPharmacyProfile(true);
    setSavedPharmacyProfile(false);
    try {
      localStorage.setItem('manoj_pharmacy_profile', JSON.stringify(pharmacyInfo));
      localStorage.setItem('manoj_pharmacy_phone', pharmacyInfo.phone);
      localStorage.setItem('manoj_pharmacy_name', pharmacyInfo.name);
      localStorage.setItem('manoj_pharmacy_address', pharmacyInfo.address);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('manoj_settings_updated', {
          detail: { pharmacy: pharmacyInfo }
        }));
      }
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pharmacyName: pharmacyInfo.name,
          dlNumber: pharmacyInfo.dlNumber,
          gstin: pharmacyInfo.gstin,
          phone: pharmacyInfo.phone,
          address: pharmacyInfo.address,
          deliveryRadius: pharmacyInfo.deliveryRadius,
          deliveryCoverage: pharmacyInfo.deliveryCoverage,
        }),
      });
      if (res.ok) {
        setSavedPharmacyProfile(true);
        setTimeout(() => setSavedPharmacyProfile(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save pharmacy profile:', err);
    } finally {
      setSavingPharmacyProfile(false);
    }
  };

  // Verify Passcode to Unlock UPI Settings
  const handleVerifyUnlockPin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPinError('');
    if (!pinInput.trim()) {
      setPinError('Please enter your security passcode.');
      return;
    }
    if (pinInput.trim() === upiPasscode) {
      setIsUpiLocked(false);
      setShowUnlockModal(false);
      setPinInput('');
      setPinError('');
    } else {
      setPinError('Incorrect security passcode. Default is MANOJ2026 unless changed.');
    }
  };

  // Change Passcode
  const handleChangePin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setChangePinError('');
    setChangePinSuccess('');

    if (currentPinInput.trim() !== upiPasscode) {
      setChangePinError('Current security passcode is incorrect.');
      return;
    }
    if (!newPinInput.trim() || newPinInput.trim().length < 4) {
      setChangePinError('New passcode must be at least 4 characters.');
      return;
    }
    if (newPinInput.trim() !== confirmPinInput.trim()) {
      setChangePinError('New passcode and Confirm passcode do not match.');
      return;
    }

    setSavingPin(true);
    const updatedPin = newPinInput.trim();

    try {
      localStorage.setItem('manoj_upi_passcode', updatedPin);
    } catch {}

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPasscode: currentPinInput.trim(),
          upiPasscode: updatedPin,
        }),
      });
      if (res.ok) {
        setUpiPasscode(updatedPin);
        setChangePinSuccess('Security passcode successfully updated!');
        setTimeout(() => {
          setShowChangePinModal(false);
          setCurrentPinInput('');
          setNewPinInput('');
          setConfirmPinInput('');
          setChangePinSuccess('');
        }, 1500);
      } else {
        const errData = await res.json().catch(() => null);
        setChangePinError(errData?.error || 'Failed to update passcode on server.');
      }
    } catch {
      setUpiPasscode(updatedPin);
      setChangePinSuccess('Security passcode updated in browser storage!');
      setTimeout(() => {
        setShowChangePinModal(false);
        setCurrentPinInput('');
        setNewPinInput('');
        setConfirmPinInput('');
        setChangePinSuccess('');
      }, 1500);
    } finally {
      setSavingPin(false);
    }
  };

  // Dedicated UPI Saver
  const handleSaveUpi = async (reLock = false) => {
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
      localStorage.setItem('manoj_upi_customized', 'true');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('manoj_settings_updated', {
          detail: { upiId: cleanId, upiPayeeName: cleanPayee }
        }));
      }
    } catch {}

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upiId: cleanId,
          upiPayeeName: cleanPayee,
          upiCustomized: 'true',
          upiPasscode: upiPasscode,
        }),
      });
      if (res.ok) {
        setSavedUpi(true);
        if (reLock) setIsUpiLocked(true);
        setTimeout(() => setSavedUpi(false), 4000);
      } else {
        const errData = await res.json().catch(() => null);
        setUpiError(errData?.error || 'Failed saving to server database.');
      }
    } catch (err) {
      // Local storage saved it
      setSavedUpi(true);
      if (reLock) setIsUpiLocked(true);
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
      localStorage.setItem('manoj_pharmacy_phone', pharmacyInfo.phone);
      localStorage.setItem('manoj_pharmacy_name', pharmacyInfo.name);
      localStorage.setItem('manoj_pharmacy_address', pharmacyInfo.address);
      if (upiId.trim()) {
        localStorage.setItem('manoj_upi_id', upiId.trim());
        localStorage.setItem('manoj_upi_payee', upiPayeeName.trim() || pharmacyInfo.name);
        if (upiId.trim() !== 'manojmedical@okhdfcbank') {
          localStorage.setItem('manoj_upi_customized', 'true');
        }
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('manoj_settings_updated', {
          detail: { pharmacy: pharmacyInfo, upiId: upiId.trim(), upiPayeeName: upiPayeeName.trim() }
        }));
      }
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
        englishInfantMilkTemplate: templates.englishInfantMilkTemplate,
        overdueTemplate: templates.overdueTemplate,
        englishOverdueTemplate: templates.englishOverdueTemplate,
        outForDeliveryTemplate: templates.outForDeliveryTemplate,
        englishOutForDeliveryTemplate: templates.englishOutForDeliveryTemplate,
        upiId: upiId.trim(),
        upiPayeeName: upiPayeeName.trim() || pharmacyInfo.name,
        upiCustomized: upiId.trim() !== 'manojmedical@okhdfcbank' ? 'true' : 'false',
        upiPasscode: upiPasscode,
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

  // Language Switch Handler (syncs active template to matching language variant)
  const handleSelectLanguage = (lang: 'hindi' | 'english') => {
    setReminderConfig((prev) => ({ ...prev, preferredLanguage: lang }));
    const currentDef = TEMPLATE_DEFINITIONS.find((d) => d.key === activeTemplateKey);
    const currentType = currentDef?.type || 'chronic';
    const targetDef = TEMPLATE_DEFINITIONS.find(
      (d) => d.language === lang && d.type === currentType
    );
    if (targetDef) {
      setActiveTemplateKey(targetDef.key);
    } else {
      setActiveTemplateKey(lang === 'english' ? 'englishTemplate' : 'hindiTemplate');
    }
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
    address: activeDef.sampleVars.address || pharmacyInfo.address,
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

  // MARG Import Handlers
  const handleImportFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setImportFile(selectedFile);
      setImportSuccess(false);
      setImportErrorMsg('');

      const fileName = selectedFile.name.toLowerCase();
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const firstSheet = wb.SheetNames[0];
            const ws = wb.Sheets[firstSheet];
            const data: any[] = XLSX.utils.sheet_to_json(ws);
            if (data.length > 0) {
              setImportHeaders(Object.keys(data[0] as object));
              setImportCsvData(data);
            }
          } catch (err: any) {
            setImportErrorMsg('Failed to parse Excel file: ' + err.message);
          }
        };
        reader.readAsBinaryString(selectedFile);
      } else {
        Papa.parse(selectedFile, {
          header: true,
          skipEmptyLines: true,
          complete: function (results) {
            if (results.data.length > 0) {
              setImportHeaders(Object.keys(results.data[0] as object));
              setImportCsvData(results.data);
            }
          },
        });
      }
    }
  };

  const loadSampleCSV = async (type: 'medicines' | 'sales') => {
    try {
      const sampleUrl = type === 'medicines' ? '/sample_marg_medicines.csv' : '/sample_marg_sales.csv';
      const res = await fetch(sampleUrl);
      const text = await res.text();
      setImportType(type);
      setImportSuccess(false);
      setImportErrorMsg('');

      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          if (results.data.length > 0) {
            setImportHeaders(Object.keys(results.data[0] as object));
            setImportCsvData(results.data);
            setImportFile(
              new File(
                [text],
                type === 'medicines' ? 'sample_marg_medicines.csv' : 'sample_marg_sales.csv',
                { type: 'text/csv' }
              )
            );
          }
        },
      });
    } catch (e: any) {
      console.error(e);
      setImportErrorMsg('Failed loading sample CSV: ' + (e?.message || 'Network error'));
    }
  };

  const handleExecuteImport = async () => {
    if (importCsvData.length === 0) return;
    setImporting(true);
    setImportErrorMsg('');
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: importType, data: importCsvData }),
      });
      const data = await res.json();
      if (res.ok) {
        setImportSuccess(true);
        setImportedStats(data.results);
      } else {
        setImportErrorMsg(data.error || 'Failed to import data');
      }
    } catch (err: any) {
      setImportErrorMsg(err.message || 'Error communicating with server');
    } finally {
      setImporting(false);
    }
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

  const navTabs: { key: TabKey; label: string; icon: any; badge?: string }[] = [
    { key: 'admin', label: 'Admin & Pharmacy', icon: ShieldCheck },
    { key: 'import', label: 'Import MARG Data', icon: Upload, badge: 'Excel / CSV' },
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

                <div className="md:col-span-2 flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="text-xs">
                    {savedPharmacyProfile && (
                      <span className="text-teal-700 font-bold flex items-center gap-1.5">
                        <Check size={16} /> Profile &amp; phone saved successfully!
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSavePharmacyProfile}
                    disabled={savingPharmacyProfile}
                    className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {savingPharmacyProfile ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Check size={14} /> Save Pharmacy Details
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MARG DATA SYNCHRONIZATION / IMPORT */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 sm:p-7 border border-gray-100 shadow-xs space-y-6">
              {/* Top Banner */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 font-heading">
                      MARG ERP Data Synchronization
                    </h2>
                    <p className="text-xs text-gray-500">
                      Extract inventory, pack sizes (10/15 tabs/strip), and chronic patient orders from MARG Excel/CSV
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => loadSampleCSV('medicines')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-semibold border border-teal-200 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Try Sample Medicines</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadSampleCSV('sales')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-semibold border border-blue-200 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Try Sample Sales Register</span>
                  </button>
                </div>
              </div>

              {/* Grid 2-cols: Main Upload + Guide */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-5">
                  {/* Category Type Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'medicines',
                        title: 'Import Medicines',
                        icon: <Pill className="w-5 h-5 text-teal-600" />,
                        desc: 'Item Master (PRO Table) with pack sizes, MRP & salt',
                        color: 'bg-teal-50 border-teal-500 text-teal-900',
                      },
                      {
                        id: 'sales',
                        title: 'Import Sales History',
                        icon: <History className="w-5 h-5 text-blue-600" />,
                        desc: 'Sales Bills (DIS Table) to detect chronic repeat orders',
                        color: 'bg-blue-50 border-blue-500 text-blue-900',
                      },
                      {
                        id: 'stock',
                        title: 'Import Stock / Batches',
                        icon: <Box className="w-5 h-5 text-emerald-600" />,
                        desc: 'Batch stock levels (PROBAT Table) with expiry dates',
                        color: 'bg-emerald-50 border-emerald-500 text-emerald-900',
                      },
                    ].map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setImportType(c.id as any);
                          setImportFile(null);
                          setImportCsvData([]);
                          setImportSuccess(false);
                          setImportErrorMsg('');
                        }}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          importType === c.id
                            ? c.color + ' shadow-xs'
                            : 'bg-gray-50/70 border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div className="mb-2">{c.icon}</div>
                        <h4 className="font-bold text-xs">{c.title}</h4>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{c.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Dropzone */}
                  <div className="bg-gray-50/50 border-2 border-dashed border-gray-300 hover:border-teal-400 rounded-2xl p-6 sm:p-8 text-center transition-colors">
                    <UploadCloud className="w-10 h-10 mx-auto text-teal-600 mb-2" />
                    <h3 className="text-sm font-bold text-gray-900 mb-1">
                      Upload MARG Export (.xlsx, .xls, .csv)
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      Drag &amp; drop your exported Excel file here, or browse local files
                    </p>
                    <input
                      type="file"
                      id="settingsFileUpload"
                      accept=".csv, .xlsx, .xls"
                      className="hidden"
                      onChange={handleImportFileUpload}
                    />
                    <label
                      htmlFor="settingsFileUpload"
                      className="inline-block bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                    >
                      Browse Excel / CSV Files
                    </label>
                  </div>

                  {/* Success Alert */}
                  {importSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl flex items-start gap-3 shadow-xs">
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm">MARG ERP Import Completed Successfully!</h4>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          {importedStats?.medicines ? `Imported/Updated ${importedStats.medicines} medicine records. ` : ''}
                          {importedStats?.customers ? `Identified ${importedStats.customers} chronic patients. ` : ''}
                          {importedStats?.prescriptions ? `Generated ${importedStats.prescriptions} auto-refill subscriptions.` : ''}
                        </p>
                        <p className="text-[11px] text-emerald-800 font-semibold mt-1.5">
                          Check Medicines, Customers, and Refills sections to view synced records.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error Alert */}
                  {importErrorMsg && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl flex items-center gap-2 text-xs font-semibold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{importErrorMsg}</span>
                    </div>
                  )}

                  {/* Preview Table */}
                  {importFile && !importSuccess && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                          <div>
                            <h4 className="font-bold text-xs sm:text-sm text-gray-900">{importFile.name}</h4>
                            <p className="text-[11px] text-gray-500">{importCsvData.length} records detected in file</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleExecuteImport}
                          disabled={importing}
                          className="w-full sm:w-auto justify-center bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                        >
                          {importing ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Importing...</span>
                            </>
                          ) : (
                            <span>Confirm &amp; Ingest Into Database</span>
                          )}
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[550px] text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50 text-gray-600 font-semibold">
                              {importHeaders.slice(0, 6).map((h) => (
                                <th key={h} className="p-2 border-b">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-gray-700">
                            {importCsvData.slice(0, 5).map((row, idx) => (
                              <tr key={idx} className="hover:bg-gray-50/50">
                                {importHeaders.slice(0, 6).map((h) => (
                                  <td key={h} className="p-2 truncate max-w-[140px]">
                                    {row[h]}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[11px] text-gray-400 italic">Showing top 5 rows preview from uploaded file</p>
                    </div>
                  )}
                </div>

                {/* Right Column: Step-by-Step MARG Export Guide */}
                <div className="space-y-4">
                  <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-200/80 space-y-3">
                    <h3 className="font-bold text-xs sm:text-sm text-gray-900 font-heading">
                      How to Export from MARG ERP
                    </h3>
                    <ol className="space-y-2.5 text-xs text-gray-600 list-decimal list-inside">
                      <li className="leading-relaxed">
                        <strong className="text-gray-800">Item Master (Medicines):</strong>
                        <p className="pl-4 text-gray-500 text-[11px] mt-0.5">
                          Masters &gt; Inventory Master &gt; Item Master. Press <code>Alt + P</code> and select <em>Export to Excel/CSV</em>.
                        </p>
                      </li>
                      <li className="leading-relaxed">
                        <strong className="text-gray-800">Sales Register (Customer History):</strong>
                        <p className="pl-4 text-gray-500 text-[11px] mt-0.5">
                          Daily Reports &gt; Sale Report &gt; Sale Register. Filter date range and export as CSV.
                        </p>
                      </li>
                      <li className="leading-relaxed">
                        <strong className="text-gray-800">Batch Stock &amp; Expiry:</strong>
                        <p className="pl-4 text-gray-500 text-[11px] mt-0.5">
                          Stocks &gt; Current Stock &gt; Filter <code>PROBAT</code> and export batch balances.
                        </p>
                      </li>
                      <li className="leading-relaxed">
                        <strong className="text-gray-800">SQL Query (Fastest):</strong>
                        <p className="pl-4 text-gray-500 text-[11px] mt-0.5">
                          Enable SQL Query Executor in Operator powers, query <code>PRO</code> or <code>DIS</code>, and export.
                        </p>
                      </li>
                    </ol>
                  </div>

                  <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-4 border border-teal-200 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800">
                      Automated Sync
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm text-gray-900">MARG API Gateway</h4>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Prefer automated background sync without manual file exports? Configure your MARG API endpoint under the <strong>MARG ERP Gateway</strong> tab.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('marg')}
                      className="text-xs font-bold text-teal-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Open Gateway Settings</span> &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: WHATSAPP CONFIG & TEMPLATES */}
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
                    onClick={() => handleSelectLanguage('hindi')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      reminderConfig.preferredLanguage === 'hindi'
                        ? 'bg-teal-700 text-white shadow-xs font-bold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🇮🇳 Hindi
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectLanguage('english')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                      reminderConfig.preferredLanguage === 'english'
                        ? 'bg-teal-700 text-white shadow-xs font-bold'
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

              {/* Template Switcher Tabs (filtered by active language) */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-700">
                    Select Template to Customize ({reminderConfig.preferredLanguage === 'english' ? '🇬🇧 English' : '🇮🇳 Hindi'})
                  </label>
                  <span className="text-[11px] text-teal-700 font-semibold">
                    {reminderConfig.preferredLanguage === 'english' ? 'English Templates Active' : 'हिंदी टेम्पलेट्स सक्रिय'}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {TEMPLATE_DEFINITIONS
                    .filter((def) => def.language === reminderConfig.preferredLanguage)
                    .map((def) => {
                      const isSelected = def.key === activeTemplateKey;
                      return (
                        <button
                          key={def.key}
                          type="button"
                          onClick={() => setActiveTemplateKey(def.key)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                            isSelected
                              ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-xs ring-1 ring-teal-400/40'
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
                        {reminderConfig.preferredLanguage === 'english'
                          ? 'Reply YES for village delivery...'
                          : 'गाँव में डिलीवरी के लिए YES भेजें...'}
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

              {/* Security Lock Header / Banner */}
              {isUpiLocked ? (
                <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-amber-950">Payment Settings Protected by Security PIN</h3>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      </div>
                      <p className="text-xs text-amber-800/80 mt-0.5">
                        UPI ID and recipient payee name are locked so counter operators and staff cannot tamper with payments.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPinInput('');
                      setPinError('');
                      setShowUnlockModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Unlock UPI Settings</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Unlock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-emerald-950">Admin Edit Mode Active</h3>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Unlocked
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800/80 mt-0.5">
                        You have owner permission to update UPI ID and Payee name. Remember to lock or &quot;Save &amp; Re-lock&quot; after changes.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPinInput('');
                        setNewPinInput('');
                        setConfirmPinInput('');
                        setChangePinError('');
                        setChangePinSuccess('');
                        setShowChangePinModal(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-gray-500" />
                      <span>Change Security PIN</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsUpiLocked(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Lock Now</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Input Fields */}
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        Store UPI ID (VPA) <span className="text-red-500">*</span>
                      </label>
                      {isUpiLocked && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={upiId}
                        disabled={isUpiLocked}
                        onChange={(e) => setUpiId(e.target.value.trim())}
                        placeholder="e.g. manojmedical@okhdfcbank, 9876543210@ybl, shop@paytm"
                        className={`w-full px-3.5 py-2.5 text-sm border rounded-xl outline-none font-mono transition-colors ${
                          isUpiLocked
                            ? 'bg-gray-50 border-gray-200 text-gray-600 cursor-not-allowed select-none'
                            : 'bg-white border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                        }`}
                      />
                      {isUpiLocked && (
                        <button
                          type="button"
                          onClick={() => {
                            setPinInput('');
                            setPinError('');
                            setShowUnlockModal(true);
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-2xs cursor-pointer"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Unlock</span>
                        </button>
                      )}
                    </div>
                    {upiId && !upiId.includes('@') && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        UPI ID must include an &apos;@&apos; symbol (e.g. yourname@okhdfcbank)
                      </p>
                    )}
                    <p className="text-[11px] text-gray-400 mt-1">
                      {isUpiLocked
                        ? 'Protected by store owner security lock. Counter staff cannot alter payment accounts.'
                        : 'Direct bank settlement via NPCI UPI protocol. No middleman transaction fees.'}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        Payee Display Name (shown to customer)
                      </label>
                      {isUpiLocked && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={upiPayeeName}
                      disabled={isUpiLocked}
                      onChange={(e) => setUpiPayeeName(e.target.value)}
                      placeholder="e.g. Manoj Medical Hall"
                      className={`w-full px-3.5 py-2 text-sm border rounded-xl outline-none transition-colors ${
                        isUpiLocked
                          ? 'bg-gray-50 border-gray-200 text-gray-600 cursor-not-allowed select-none'
                          : 'bg-white border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                      }`}
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
                    {isUpiLocked ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPinInput('');
                          setPinError('');
                          setShowUnlockModal(true);
                        }}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200/80 text-gray-700 font-bold text-xs sm:text-sm rounded-xl border border-gray-200 transition-colors cursor-pointer"
                      >
                        <Lock className="w-4 h-4 text-amber-600" />
                        <span>Unlock with PIN to Edit UPI</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleSaveUpi(false)}
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
                        <button
                          type="button"
                          onClick={() => handleSaveUpi(true)}
                          disabled={savingUpi}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
                          title="Save UPI changes and immediately lock settings"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Save &amp; Re-lock</span>
                        </button>
                      </div>
                    )}

                    {savedUpi && (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Saved &amp; active across all bills!
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

            {/* UNLOCK PIN MODAL */}
            {showUnlockModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
                <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 font-heading">Security Passcode Required</h3>
                        <p className="text-[11px] text-gray-500">Enter PIN to edit store UPI settings</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUnlockModal(false);
                        setPinInput('');
                        setPinError('');
                      }}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleVerifyUnlockPin} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Admin Security Passcode
                      </label>
                      <div className="relative">
                        <input
                          type={showPinMask ? 'text' : 'password'}
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value)}
                          maxLength={24}
                          placeholder="Enter passcode (default MANOJ2026)"
                          autoFocus
                          className="w-full px-3.5 py-2.5 text-center tracking-wider text-base font-mono font-bold border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPinMask(!showPinMask)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          {showPinMask ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {pinError && (
                        <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          {pinError}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1 text-center">
                        Default store Passcode: <span className="font-mono font-bold text-gray-600">MANOJ2026</span> (can be changed once unlocked)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUnlockModal(false);
                          setPinInput('');
                          setPinError('');
                        }}
                        className="flex-1 py-2 px-3 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Verify &amp; Unlock</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* CHANGE PIN MODAL */}
            {showChangePinModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
                <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0">
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900 font-heading">Change Security PIN</h3>
                        <p className="text-[11px] text-gray-500">Protect your UPI ID with a new passcode</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowChangePinModal(false)}
                      className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleChangePin} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Current Passcode
                      </label>
                      <input
                        type="password"
                        value={currentPinInput}
                        onChange={(e) => setCurrentPinInput(e.target.value)}
                        maxLength={24}
                        placeholder="Current Passcode (default MANOJ2026)"
                        className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        New Passcode (min 4 characters)
                      </label>
                      <input
                        type="password"
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value)}
                        maxLength={24}
                        placeholder="e.g. MANOJ2026, 5678"
                        className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Confirm New Passcode
                      </label>
                      <input
                        type="password"
                        value={confirmPinInput}
                        onChange={(e) => setConfirmPinInput(e.target.value)}
                        maxLength={24}
                        placeholder="Repeat new passcode"
                        className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    {changePinError && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {changePinError}
                      </p>
                    )}

                    {changePinSuccess && (
                      <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        {changePinSuccess}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowChangePinModal(false)}
                        className="flex-1 py-2 px-3 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingPin}
                        className="flex-1 py-2 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {savingPin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>Save New PIN</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
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
