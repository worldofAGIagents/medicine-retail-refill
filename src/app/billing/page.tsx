'use client';

import { DashboardLayout } from '@/components/layout';
import React, { useState, useEffect, useRef } from 'react';
import {
  Receipt, Search, Plus, Minus, Trash2, CheckCircle2, AlertCircle,
  Printer, MessageCircle, QrCode, IndianRupee, Banknote, Smartphone,
  User, RefreshCw, X, ArrowRight, ShieldCheck, Tag, Percent, Sparkles,
  Layers, Check, ExternalLink, Calendar, MapPin, Stethoscope
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  BillItemInput,
  CalculatedBillItem,
  BillSummary,
  calculateLineItem,
  calculateBillSummary,
  getDefaultDiscountPercent,
  isInfantFormula,
  generateInvoiceNumber,
  generateWhatsAppBillText,
  generateUpiPaymentLink,
  PharmacyDetails,
} from '@/lib/billing-engine';
import { detectMedicineCategory } from '@/lib/medicine-classifier';
import {
  getLocalCustomers,
  mergeCustomerLists,
  upsertLocalCustomer,
  clean10DigitPhone,
  CUSTOMERS_UPDATED_EVENT,
} from '@/lib/customer-sync';

interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  unitsPerPack: number;
  packagingType: string;
  mrp: number;
  manufacturer?: string;
  margItemCode?: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  locality?: string;
  address?: string;
}

export default function BillingPage() {
  // Cart state
  const [items, setItems] = useState<BillItemInput[]>([]);
  const [extraDiscount, setExtraDiscount] = useState<number>(0);

  // Search medicines state
  const [searchQuery, setSearchQuery] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Custom / New Product modal & inline state
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customGeneric, setCustomGeneric] = useState('');
  const [customCategory, setCustomCategory] = useState('Blood Pressure');
  const [customPackaging, setCustomPackaging] = useState('strip');
  const [customUnitsPerPack, setCustomUnitsPerPack] = useState(10);
  const [customManufacturer, setCustomManufacturer] = useState('');
  const [customQty, setCustomQty] = useState(1);
  const [customMrp, setCustomMrp] = useState('');
  const [customDisc, setCustomDisc] = useState(10);
  const [customIsInfant, setCustomIsInfant] = useState(false);
  const [customSaveToCatalog, setCustomSaveToCatalog] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productSuccessAlert, setProductSuccessAlert] = useState('');

  // Customer state
  const [isWalkIn, setIsWalkIn] = useState(true);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerVillage, setCustomerVillage] = useState('Sarfuddinpur');
  const [doctorName, setDoctorName] = useState('');
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([]);
  const [custSearch, setCustSearch] = useState('');
  const [custDropdownOpen, setCustDropdownOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Payment state
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'credit'>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');

  // Pharmacy Profile Settings (GST and DL are omitted from bills as per requirement)
  const loadStoredPharmacyDetails = (): PharmacyDetails => {
    const defaults: PharmacyDetails = {
      name: 'Manoj Medical Hall',
      address: 'Sarfuddinpur, Gopalpur, Muzaffarpur, Bihar - 843118',
      phone: '9431422744',
      dlNumber: '',
      gstin: '',
      upiId: 'manojmedical@okhdfcbank',
      upiPayeeName: 'Manoj Medical Hall',
    };

    if (typeof window === 'undefined') return defaults;

    try {
      const profileRaw = localStorage.getItem('manoj_pharmacy_profile');
      if (profileRaw) {
        const profile = JSON.parse(profileRaw);
        if (profile.name) defaults.name = profile.name;
        if (profile.address) defaults.address = profile.address;
        if (profile.phone !== undefined && profile.phone !== '+91 98765 43210' && profile.phone !== '') {
          defaults.phone = profile.phone;
        }
        if (profile.dlNumber !== undefined && profile.dlNumber !== 'DL-2024-001234') {
          defaults.dlNumber = profile.dlNumber;
        }
        if (profile.gstin !== undefined && profile.gstin !== '07AAAAA0000A1Z5') {
          defaults.gstin = profile.gstin;
        }
      }

      const storedPhone = localStorage.getItem('manoj_pharmacy_phone');
      if (storedPhone !== null && storedPhone !== '+91 98765 43210' && storedPhone !== '') {
        defaults.phone = storedPhone;
      }

      const storedName = localStorage.getItem('manoj_pharmacy_name');
      if (storedName) defaults.name = storedName;

      const storedAddress = localStorage.getItem('manoj_pharmacy_address');
      if (storedAddress) defaults.address = storedAddress;

      const localUpi = localStorage.getItem('manoj_upi_id');
      if (localUpi && localUpi.includes('@')) {
        defaults.upiId = localUpi.trim();
      }

      const localPayee = localStorage.getItem('manoj_upi_payee');
      if (localPayee) {
        defaults.upiPayeeName = localPayee.trim();
      }
    } catch {}

    return defaults;
  };

  const [pharmacy, setPharmacy] = useState<PharmacyDetails>(loadStoredPharmacyDetails);

  // Completed Bill Modal
  const [completedBill, setCompletedBill] = useState<BillSummary | null>(null);
  const [savingBill, setSavingBill] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const custSearchContainerRef = useRef<HTMLDivElement>(null);

  // Load pharmacy settings & customers on mount with real-time synchronization
  useEffect(() => {
    const syncSettings = () => {
      // 1. Immediately hydrate from localStorage (offline-first & cross-page sync)
      const local = loadStoredPharmacyDetails();
      setPharmacy((prev) => ({
        ...prev,
        ...local,
      }));

      // 2. Fetch fresh settings from server with cache-busting
      fetch(`/api/settings?t=${Date.now()}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            setPharmacy((prev) => {
              const localUpi = typeof window !== 'undefined' ? localStorage.getItem('manoj_upi_id') : null;
              const serverUpi = data.upiId && data.upiId.includes('@') ? data.upiId.trim() : null;
              const effectiveUpi = serverUpi || (localUpi && localUpi.includes('@') ? localUpi.trim() : prev.upiId);

              let localPhone: string | undefined = undefined;
              if (typeof window !== 'undefined') {
                const direct = localStorage.getItem('manoj_pharmacy_phone');
                if (direct !== null && direct !== '+91 98765 43210') {
                  localPhone = direct;
                } else {
                  const prof = localStorage.getItem('manoj_pharmacy_profile');
                  if (prof) {
                    try { localPhone = JSON.parse(prof).phone; } catch {}
                  }
                }
              }

              const serverPhone = data.phone !== undefined && data.phone !== '+91 98765 43210' && data.phone !== '' ? data.phone : null;
              const effectivePhone = serverPhone || (localPhone !== undefined && localPhone !== '+91 98765 43210' ? localPhone : prev.phone);

              // Update localStorage cache to match server truth
              if (typeof window !== 'undefined') {
                try {
                  if (effectiveUpi) localStorage.setItem('manoj_upi_id', effectiveUpi);
                  if (effectivePhone) localStorage.setItem('manoj_pharmacy_phone', effectivePhone);
                } catch {}
              }

              return {
                ...prev,
                name: data.pharmacyName || prev.name,
                address: data.address || prev.address,
                phone: effectivePhone,
                dlNumber: data.dlNumber !== undefined ? data.dlNumber : prev.dlNumber,
                gstin: data.gstin !== undefined ? data.gstin : prev.gstin,
                upiId: effectiveUpi,
                upiPayeeName: data.upiPayeeName || data.pharmacyName || prev.upiPayeeName,
              };
            });
          }
        })
        .catch(() => {});
    };

    syncSettings();

    // Listen for settings changes dispatched from Settings tab or across browser windows
    window.addEventListener('manoj_settings_updated', syncSettings);
    window.addEventListener('storage', syncSettings);
    window.addEventListener('focus', syncSettings);

    // 2. Fetch customers for lookup with universal merge & offline-first persistence
    const syncCustomers = () => {
      const local = getLocalCustomers();
      if (local.length > 0) {
        setExistingCustomers((prev) => (prev.length === 0 ? (local as any) : prev));
      }
      fetch(`/api/customers?t=${Date.now()}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          const rawSList = Array.isArray(data) ? data : (data?.data || []);
          const merged = mergeCustomerLists(rawSList as any, getLocalCustomers(), false);
          setExistingCustomers(merged as any);
        })
        .catch(() => {
          setExistingCustomers(getLocalCustomers() as any);
        });
    };

    syncCustomers();

    window.addEventListener(CUSTOMERS_UPDATED_EVENT, syncCustomers);

    return () => {
      window.removeEventListener('manoj_settings_updated', syncSettings);
      window.removeEventListener('storage', syncSettings);
      window.removeEventListener('focus', syncSettings);
      window.removeEventListener(CUSTOMERS_UPDATED_EVENT, syncCustomers);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (custSearchContainerRef.current && !custSearchContainerRef.current.contains(e.target as Node)) {
        setCustDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search medicines
  const searchMedicines = (q: string) => {
    setSearchLoading(true);
    const params = new URLSearchParams({ limit: '30' });
    if (q.trim()) params.set('q', q.trim());

    fetch(`/api/medicines?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.data || []);
        setMedicines(list);
        setSearchLoading(false);
      })
      .catch(() => setSearchLoading(false));
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setDropdownOpen(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchMedicines(val);
    }, 200);
  };

  // Add medicine to cart
  const handleAddMedicine = (med: Medicine) => {
    const isInfant = isInfantFormula(med.name, med.genericName, med.category);
    const defaultDisc = isInfant ? 0 : 10;
    const packUnits = med.unitsPerPack > 0 ? med.unitsPerPack : (isInfant ? 400 : 10);

    setItems((prev) => {
      // Check if already in cart
      const existingIdx = prev.findIndex((p) => p.medicineId === med.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }

      const newItem: BillItemInput = {
        medicineId: med.id,
        name: med.name,
        genericName: med.genericName,
        category: med.category,
        packaging: isInfant ? `${packUnits}g Tin` : `${packUnits} tabs/strip`,
        unitsPerPack: packUnits,
        unitMode: isInfant ? 'tins' : 'strips',
        mrp: med.mrp || 0,
        quantity: 1,
        discountPercent: defaultDisc,
      };
      return [...prev, newItem];
    });

    setSearchQuery('');
    setDropdownOpen(false);
  };

  // Add custom item or permanently save new product to catalog
  const handleAddCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customMrp) return;

    const mrpVal = parseFloat(customMrp);
    if (isNaN(mrpVal) || mrpVal <= 0) return;

    const isInfant = customIsInfant || customCategory === 'Infant Milk' || isInfantFormula(customName);
    const discVal = isInfant ? 0 : (customDisc >= 0 ? customDisc : 10);
    const finalCategory = isInfant ? 'Infant Milk' : (customCategory || 'Blood Pressure');

    let createdMedId: string | undefined = undefined;

    if (customSaveToCatalog) {
      setSavingProduct(true);
      try {
        const res = await fetch('/api/medicines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: customName.trim(),
            genericName: customGeneric.trim() || customName.trim(),
            category: finalCategory,
            packagingType: customPackaging || (isInfant ? 'tin' : 'strip'),
            unitsPerPack: Number(customUnitsPerPack) || (isInfant ? 1 : 10),
            mrp: mrpVal,
            manufacturer: customManufacturer.trim() || undefined,
            isChronicMed: finalCategory !== 'General / OTC',
          }),
        });

        if (res.ok) {
          const newMed = await res.json();
          createdMedId = newMed.id;
          setMedicines((prev) => [newMed, ...prev]);
          setProductSuccessAlert(`✓ "${newMed.name}" added to bill and saved to catalog!`);
          setTimeout(() => setProductSuccessAlert(''), 4000);
        }
      } catch (err) {
        console.error('Failed to save to catalog:', err);
      } finally {
        setSavingProduct(false);
      }
    }

    const newItem: BillItemInput = {
      medicineId: createdMedId,
      name: customName.trim(),
      genericName: customGeneric.trim() || undefined,
      category: finalCategory,
      packaging: `${customPackaging || 'strip'} (${customUnitsPerPack || 10}s)`,
      unitsPerPack: Number(customUnitsPerPack) || 10,
      mrp: mrpVal,
      quantity: Math.max(1, customQty),
      discountPercent: discVal,
    };

    setItems((prev) => [newItem, ...prev]);

    // Reset form
    setCustomName('');
    setCustomGeneric('');
    setCustomMrp('');
    setCustomQty(1);
    setCustomCategory('Blood Pressure');
    setCustomPackaging('strip');
    setCustomUnitsPerPack(10);
    setCustomManufacturer('');
    setCustomDisc(10);
    setCustomIsInfant(false);
    setShowCustomItem(false);
  };

  // Update item in cart
  const handleUpdateItem = (index: number, updates: Partial<BillItemInput>) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Select existing customer
  const handleSelectCustomer = (cust: Customer) => {
    setSelectedCustomerId(cust.id);
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
    if (cust.locality) setCustomerVillage(cust.locality);
    setIsWalkIn(false);
    setCustSearch(`${cust.name} (${cust.phone})`);
    setCustDropdownOpen(false);
  };

  // Reset to walk-in
  const handleSetWalkIn = () => {
    setSelectedCustomerId(null);
    setIsWalkIn(true);
    setCustomerName('Walk-in Customer');
    setCustomerPhone('');
    setCustomerVillage('Sarfuddinpur');
    setCustSearch('');
  };

  // Calculate bill totals
  const billSummary = calculateBillSummary(items, {
    customerName,
    customerPhone,
    customerVillage,
    doctorName,
    paymentMode,
    extraDiscount,
  });

  // Calculate change for cash payment
  const tenderedNum = parseFloat(cashTendered) || 0;
  const changeDue = tenderedNum >= billSummary.netPayable ? tenderedNum - billSummary.netPayable : 0;

  // Complete & Save Bill
  const handleCreateBill = async () => {
    if (items.length === 0) {
      setErrorMsg('Please add at least one medicine to generate a bill');
      return;
    }

    setErrorMsg('');
    setSavingBill(true);

    try {
      const payload = {
        customerId: selectedCustomerId,
        customerName: customerName.trim(),
        customerPhone: customerPhone ? customerPhone.replace(/[^0-9]/g, '').slice(-10) : undefined,
        customerVillage: customerVillage.trim(),
        doctorName: doctorName.trim() || undefined,
        invoiceNo: billSummary.invoiceNo,
        orderType: 'retail',
        paymentMode,
        paymentStatus: paymentMode === 'credit' ? 'pending' : 'collected',
        totalAmount: billSummary.netPayable,
        grossAmount: billSummary.grossAmount,
        totalDiscount: billSummary.totalDiscount,
        roundOff: billSummary.roundOff,
        items: billSummary.items.map((itm) => ({
          medicineId: itm.medicineId,
          medicineName: itm.name,
          quantity: itm.quantity,
          unitPrice: itm.effectiveRate,
          totalPrice: itm.netTotal,
          mrp: itm.effectiveRate,
          discountPercent: itm.discountPercent,
          discountAmount: itm.discountAmount,
        })),
        billingSnapshot: billSummary,
      };

      // 1. Save to local storage for offline resilience
      try {
        const rawLocal = localStorage.getItem('manoj_local_orders');
        const existingList = rawLocal ? JSON.parse(rawLocal) : [];
        const localRecord = {
          id: `local-bill-${Date.now()}`,
          ...payload,
          createdAt: new Date().toISOString(),
          customer: {
            id: selectedCustomerId || 'walkin',
            name: customerName,
            phone: customerPhone || 'Walk-in',
            city: 'Muzaffarpur',
          },
        };
        localStorage.setItem('manoj_local_orders', JSON.stringify([localRecord, ...existingList]));
      } catch (_) {}

      // Auto-register named customer into local customers and database if 10-digit phone provided
      const cleanPhone = clean10DigitPhone(customerPhone);
      if (customerName.trim() && cleanPhone.length === 10) {
        try {
          const autoCust = {
            id: selectedCustomerId || `cust-${Date.now()}`,
            name: customerName.trim(),
            phone: cleanPhone,
            locality: customerVillage.trim() || 'Sarfuudinpur',
            address: customerVillage.trim() || 'Sarfuudinpur',
            city: 'Muzaffarpur',
            primaryCondition: 'Blood Pressure',
            prescriptions: [],
            createdAt: new Date().toISOString(),
          };
          upsertLocalCustomer(autoCust as any);

          // Background push to database
          fetch('/api/customers/onboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: customerName.trim(),
              phone: cleanPhone,
              village: customerVillage.trim() || 'Sarfuudinpur',
              condition: 'Blood Pressure',
              prescriptions: [],
            }),
          }).catch(() => {});
        } catch (_) {}
      }

      // 2. Save to database via API
      try {
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (netErr) {
        console.warn('Order sync warning (persisted locally):', netErr);
      }

      setCompletedBill(billSummary);
      setSavingBill(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error generating bill');
      setSavingBill(false);
    }
  };

  // Reset bill for next customer
  const handleStartNewBill = () => {
    setItems([]);
    setExtraDiscount(0);
    setCompletedBill(null);
    setCashTendered('');
    handleSetWalkIn();
  };

  // WhatsApp share
  const handleShareWhatsApp = (bill: BillSummary) => {
    const text = generateWhatsAppBillText(bill, pharmacy);
    const phone = bill.customerPhone ? bill.customerPhone.replace(/[^0-9]/g, '') : '';
    const url = phone.length >= 10
      ? `https://api.whatsapp.com/send?phone=91${phone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Native Print
  const handlePrint = () => {
    window.print();
  };

  // Dynamic UPI Payment Link
  const upiLink = `upi://pay?pa=${encodeURIComponent(pharmacy.upiId || 'manojmedical@okhdfcbank')}&pn=${encodeURIComponent(pharmacy.upiPayeeName || pharmacy.name)}&am=${billSummary.netPayable}&cu=INR&tn=${encodeURIComponent(`Bill ${billSummary.invoiceNo}`)}`;

  return (
    <DashboardLayout>
      <div className="p-3 md:p-6 max-w-7xl mx-auto space-y-5 print:p-0 print:m-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-sm">
              <Receipt size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-heading text-gray-900">Retail Billing &amp; POS Counter</h1>
                <span className="text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-md">
                  10% Default MRP Discount
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Fast walk-in and chronic retail invoices • 0% discount on infant milk formulas • Thermal receipt &amp; UPI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleStartNewBill}
              className="flex-1 sm:flex-none px-3.5 py-2 text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw size={14} /> Clear / New Bill
            </button>
            <a
              href="/orders"
              className="px-3.5 py-2 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              Past Bills
            </a>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center gap-2 text-xs font-semibold print:hidden">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Main POS Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 print:hidden">
          
          {/* LEFT 7 COLS: Product Search & Cart Table */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Medicine Typeahead Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3" ref={searchContainerRef}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Search size={14} className="text-teal-600" />
                  Search Medicine to Add (MARG Catalog)
                </label>
                <button
                  type="button"
                  onClick={() => setShowCustomItem(!showCustomItem)}
                  className="text-[11px] text-teal-800 hover:text-teal-950 font-bold bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <Plus size={13} /> {showCustomItem ? 'Hide Entry Form' : '+ Add New Product / Item'}
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Type medicine name or generic (e.g. Telma, Glycomet, Lactogen, Pan-D)..."
                  value={searchQuery}
                  onFocus={() => {
                    setDropdownOpen(true);
                    if (medicines.length === 0) searchMedicines(searchQuery);
                  }}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-9 py-2.5 text-sm bg-gray-50/60 focus:bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchMedicines('');
                    }}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                )}

                {/* Dropdown Results */}
                {dropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-xl z-40 divide-y divide-gray-50">
                    {searchLoading ? (
                      <div className="p-4 text-xs text-gray-400 text-center">Searching 9,259 catalog medicines...</div>
                    ) : medicines.length === 0 ? (
                      <div className="p-4 text-xs text-gray-400 text-center">
                        No medicines matched. Click <strong>+ Custom / OTC Item</strong> to add manually.
                      </div>
                    ) : (
                      medicines.map((m) => {
                        const isInfant = isInfantFormula(m.name, m.genericName, m.category);
                        const disc = isInfant ? 0 : 10;
                        const inCart = items.some((it) => it.medicineId === m.id);

                        return (
                          <div
                            key={m.id}
                            onClick={() => handleAddMedicine(m)}
                            className="p-3 hover:bg-teal-50/60 cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div className="pr-3">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                                {isInfant ? (
                                  <span className="text-[10px] font-bold bg-pink-100 text-pink-700 px-1.5 py-0.2 rounded-md">
                                    Baby Milk • 0% Disc
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold bg-teal-50 text-teal-700 px-1.5 py-0.2 rounded-md">
                                    10% Off
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                <span>{m.manufacturer || 'Indian Pharma'}</span>
                                <span>•</span>
                                <span className="font-mono text-gray-600">
                                  {m.unitsPerPack} {isInfant ? 'g/tin' : 'tabs/strip'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-bold text-gray-900">MRP ₹{m.mrp}</div>
                              <div className="text-[11px] text-teal-700 font-semibold">
                                Net ₹{((m.mrp * (100 - disc)) / 100).toFixed(0)}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Product Creation Success Alert */}
              {productSuccessAlert && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl flex items-center gap-2 text-xs font-semibold animate-fadeIn">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>{productSuccessAlert}</span>
                </div>
              )}

              {/* Manually Add New Product / Custom Item Form */}
              {showCustomItem && (
                <form
                  onSubmit={handleAddCustomItem}
                  className="bg-teal-50/70 p-4 rounded-xl border border-teal-200 space-y-3.5 animate-fadeIn"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-teal-200/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-teal-950 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles size={14} className="text-teal-600" />
                        Add New Medicine / Product
                      </span>
                      <span className="text-[10px] bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded">
                        BP Category Default
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customIsInfant}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setCustomIsInfant(checked);
                          if (checked) {
                            setCustomCategory('Infant Milk');
                            setCustomPackaging('tin');
                            setCustomUnitsPerPack(1);
                            setCustomDisc(0);
                          } else {
                            setCustomCategory('Blood Pressure');
                            setCustomPackaging('strip');
                            setCustomUnitsPerPack(10);
                            setCustomDisc(10);
                          }
                        }}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span className="text-[11px] font-semibold text-pink-900">
                        Is Infant Milk Formula (0% discount, tin pack)
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                    {/* Product Name */}
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-bold text-gray-700 mb-1">
                        Brand / Medicine Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Telma 40, Glycomet 500, Pan-D, Nan Pro 1..."
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-teal-500 font-medium"
                      />
                    </div>

                    {/* Generic / Salt Composition */}
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Generic Name / Composition
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Telmisartan 40mg, Pantoprazole 40mg + Domperidone 30mg"
                        value={customGeneric}
                        onChange={(e) => setCustomGeneric(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {/* Category Dropdown (Defaults to Blood Pressure) */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Chronic Category
                      </label>
                      <select
                        value={customCategory}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomCategory(val);
                          if (val === 'Infant Milk') {
                            setCustomIsInfant(true);
                            setCustomPackaging('tin');
                            setCustomUnitsPerPack(1);
                            setCustomDisc(0);
                          } else {
                            if (customIsInfant) {
                              setCustomIsInfant(false);
                              setCustomPackaging('strip');
                              setCustomUnitsPerPack(10);
                              setCustomDisc(10);
                            }
                          }
                        }}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-teal-500 font-semibold text-gray-800"
                      >
                        <option value="Blood Pressure">Blood Pressure (BP - Default)</option>
                        <option value="Diabetes">Diabetes</option>
                        <option value="Thyroid">Thyroid</option>
                        <option value="Cholesterol">Cholesterol / Heart</option>
                        <option value="Infant Milk">Infant Milk (0% Disc)</option>
                        <option value="General / OTC">General / OTC</option>
                      </select>
                    </div>

                    {/* Packaging Type */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Packaging
                      </label>
                      <select
                        value={customPackaging}
                        onChange={(e) => setCustomPackaging(e.target.value)}
                        className="w-full px-2 py-2 text-xs bg-white border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        <option value="strip">Strip (Tabs/Caps)</option>
                        <option value="tin">Tin (Formula)</option>
                        <option value="bottle">Bottle (Syrup/Drops)</option>
                        <option value="tube">Tube (Ointment/Gel)</option>
                        <option value="packet">Packet / Sachet</option>
                      </select>
                    </div>

                    {/* Units per Pack */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Units / Pack
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={customUnitsPerPack}
                        onChange={(e) => setCustomUnitsPerPack(parseInt(e.target.value, 10) || 10)}
                        className="w-full px-2 py-2 text-xs bg-white border border-gray-300 rounded-lg outline-none text-center font-semibold"
                      />
                    </div>

                    {/* MRP ₹ */}
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">
                        MRP ₹ (Per Pack) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0"
                        placeholder="MRP ₹"
                        value={customMrp}
                        onChange={(e) => setCustomMrp(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border-2 border-amber-400 focus:border-amber-600 rounded-lg outline-none font-extrabold text-gray-900"
                      />
                    </div>

                    {/* Manufacturer (Optional) */}
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Manufacturer (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Glenmark, Cipla, Nestle..."
                        value={customManufacturer}
                        onChange={(e) => setCustomManufacturer(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg outline-none"
                      />
                    </div>

                    {/* Bill Quantity */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Bill Qty
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={customQty}
                        onChange={(e) => setCustomQty(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-2 py-2 text-xs bg-white border border-gray-300 rounded-lg outline-none text-center font-bold"
                      />
                    </div>

                    {/* Discount % */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Disc %
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={customDisc}
                        disabled={customIsInfant || customCategory === 'Infant Milk'}
                        onChange={(e) => setCustomDisc(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-2 py-2 text-xs bg-white border border-gray-300 rounded-lg outline-none text-center font-bold"
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="sm:col-span-4 flex flex-col justify-end gap-1">
                      <button
                        type="submit"
                        disabled={savingProduct}
                        className="w-full py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                      >
                        {savingProduct ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" /> Saving to Catalog...
                          </>
                        ) : (
                          <>
                            <Plus size={14} /> Add to Bill
                          </>
                        )}
                      </button>
                    </div>

                    {/* Checkbox to persist to MARG catalog */}
                    <div className="sm:col-span-12 pt-1 border-t border-teal-200/60 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-teal-950 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customSaveToCatalog}
                          onChange={(e) => setCustomSaveToCatalog(e.target.checked)}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span>Save permanently to Medicine Catalog (MARG Database for future billing)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowCustomItem(false)}
                        className="text-xs text-gray-500 hover:text-gray-700 font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Cart Items List */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs divide-y divide-gray-100 overflow-hidden">
              <div className="p-3.5 bg-gray-50/80 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Bill Items ({items.length})
                  </span>
                  {items.length > 0 && (
                    <span className="text-[10px] font-semibold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                      {billSummary.totalQuantity} Units
                    </span>
                  )}
                </div>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setItems([])}
                    className="text-[11px] text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
                    <Receipt size={24} />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">No items added to bill yet</p>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Search from 9,200+ MARG medicines above or add a custom OTC item. Standard medicines automatically apply 10% discount on MRP.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[550px] overflow-y-auto">
                  {billSummary.items.map((item, idx) => (
                    <div key={item.id} className="p-3.5 hover:bg-gray-50/50 transition-colors space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 font-mono">{idx + 1}.</span>
                            <span className="font-bold text-sm text-gray-900 truncate">{item.name}</span>
                            {item.isInfantMilk ? (
                              <span className="text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-200 px-1.5 py-0.2 rounded shrink-0">
                                Infant Milk (0% Disc)
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.2 rounded shrink-0">
                                10% Off
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 pl-5 flex-wrap text-xs text-gray-600">
                            <span>{item.packaging || 'Standard Pack'}</span>
                            <span className="text-gray-300">•</span>
                            <div className="flex items-center gap-1.5 bg-amber-50/90 border border-amber-200 rounded-md px-2 py-0.5" title="Click to edit MRP directly">
                              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">MRP ₹</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={item.mrp}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleUpdateItem(idx, { mrp: isNaN(val) ? 0 : val });
                                }}
                                className="w-18 bg-white px-1.5 py-0.5 text-xs font-bold text-gray-900 border border-amber-300 rounded outline-none focus:ring-1 focus:ring-amber-500 text-right"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-sm font-bold text-gray-900">₹{item.netTotal.toFixed(2)}</div>
                            {item.discountAmount > 0 && (
                              <div className="text-[10px] text-emerald-600 font-semibold">
                                Saved ₹{item.discountAmount.toFixed(2)}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Line Item Controls: Qty & Editable Discount */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pl-5 pt-1 items-center">
                        {/* Qty Stepper */}
                        <div className="sm:col-span-4 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateItem(idx, { quantity: Math.max(1, item.quantity - 1) })}
                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold cursor-pointer border border-gray-200"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              handleUpdateItem(idx, { quantity: isNaN(val) ? 1 : Math.max(1, val) });
                            }}
                            className="w-12 text-center py-1 text-xs font-bold border border-gray-200 rounded-lg outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateItem(idx, { quantity: item.quantity + 1 })}
                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center font-bold cursor-pointer border border-gray-200"
                          >
                            <Plus size={12} />
                          </button>
                          <span className="text-[11px] text-gray-500 font-medium ml-1">pack(s)</span>
                        </div>

                        {/* Editable Discount Chips & Custom Input */}
                        <div className="sm:col-span-8 flex items-center gap-1.5 flex-wrap justify-start sm:justify-end">
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Discount:</span>
                          {[0, 5, 10, 15].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => handleUpdateItem(idx, { discountPercent: d, customDiscountAmount: undefined })}
                              className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border transition-all cursor-pointer ${
                                item.discountPercent === d && item.customDiscountAmount === undefined
                                  ? 'bg-teal-700 text-white border-teal-800 shadow-2xs font-bold'
                                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {d}%
                            </button>
                          ))}
                          <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-200">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPercent}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                handleUpdateItem(idx, {
                                  discountPercent: isNaN(val) ? 0 : val,
                                  customDiscountAmount: undefined,
                                });
                              }}
                              className="w-10 text-center text-[11px] font-bold text-gray-800 bg-transparent outline-none"
                            />
                            <span className="text-[10px] text-gray-500">%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 5 COLS: Customer Details, Payment Mode, & Summary Card */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* 1. Customer Selection */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3" ref={custSearchContainerRef}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={14} className="text-teal-600" />
                  Customer Details
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSetWalkIn}
                    className={`text-[11px] px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                      isWalkIn
                        ? 'bg-teal-700 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Walk-in Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsWalkIn(false);
                      setCustDropdownOpen(true);
                    }}
                    className={`text-[11px] px-2 py-0.5 rounded-md font-semibold transition-colors cursor-pointer ${
                      !isWalkIn
                        ? 'bg-teal-700 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Lookup Patient
                  </button>
                </div>
              </div>

              {!isWalkIn ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search patient by name or 10-digit mobile..."
                      value={custSearch}
                      onFocus={() => setCustDropdownOpen(true)}
                      onChange={(e) => {
                        setCustSearch(e.target.value);
                        setCustDropdownOpen(true);
                      }}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20 font-medium"
                    />

                    {custDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg z-30 divide-y divide-gray-50">
                        {existingCustomers
                          .filter((c) =>
                            c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
                            c.phone.includes(custSearch)
                          )
                          .slice(0, 15)
                          .map((c) => (
                            <div
                              key={c.id}
                              onClick={() => handleSelectCustomer(c)}
                              className="p-2.5 hover:bg-teal-50 cursor-pointer flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-semibold text-gray-900">{c.name}</p>
                                <p className="text-[10px] text-gray-500">{c.phone} • {c.locality || c.address || 'Sarfuddinpur'}</p>
                              </div>
                              <span className="text-[11px] font-bold text-teal-700">Select</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500">Patient Name</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500">WhatsApp Mobile</label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="9876543210"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500">Customer Name (Optional)</label>
                      <input
                        type="text"
                        placeholder="Walk-in Customer"
                        value={customerName === 'Walk-in Customer' ? '' : customerName}
                        onChange={(e) => setCustomerName(e.target.value || 'Walk-in Customer')}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500">Phone for WhatsApp (Optional)</label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="10-digit mobile"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Doctor / Village Optional */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500">Village / Locality</label>
                  <input
                    type="text"
                    value={customerVillage}
                    onChange={(e) => setCustomerVillage(e.target.value)}
                    placeholder="e.g. Sarfuddinpur, Gopalpur"
                    className="w-full px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500">Doctor / Rx Ref</label>
                  <input
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="e.g. Dr. A.K. Jha"
                    className="w-full px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-lg outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 2. Payment Mode & Dynamic QR */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                Payment Mode
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('cash')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    paymentMode === 'cash'
                      ? 'bg-teal-50 border-teal-600 text-teal-800 shadow-2xs font-bold'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Banknote size={18} className="mx-auto mb-1 text-teal-700" />
                  <span className="text-xs block">Cash (रोकड़)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('upi')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    paymentMode === 'upi'
                      ? 'bg-blue-50 border-blue-600 text-blue-800 shadow-2xs font-bold'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Smartphone size={18} className="mx-auto mb-1 text-blue-700" />
                  <span className="text-xs block">UPI / QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('credit')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    paymentMode === 'credit'
                      ? 'bg-amber-50 border-amber-600 text-amber-800 shadow-2xs font-bold'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Calendar size={18} className="mx-auto mb-1 text-amber-700" />
                  <span className="text-xs block">Credit (खाता)</span>
                </button>
              </div>

              {/* Cash Tendered & Change Calculator */}
              {paymentMode === 'cash' && billSummary.netPayable > 0 && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-600">Cash Tendered (₹):</span>
                    <input
                      type="number"
                      placeholder="e.g. 500"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-24 text-right px-2 py-1 text-xs font-bold bg-white border border-gray-300 rounded-lg outline-none"
                    />
                  </div>
                  {/* Quick tender notes */}
                  <div className="flex items-center gap-1 justify-end flex-wrap">
                    <span className="text-[10px] text-gray-400">Quick:</span>
                    {[billSummary.netPayable, 100, 200, 500, 1000, 2000].filter((v) => v >= billSummary.netPayable).slice(0, 4).map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCashTendered(String(amt))}
                        className="text-[10px] bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-700 hover:bg-gray-100 cursor-pointer font-mono"
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                  {tenderedNum > 0 && (
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200 text-xs">
                      <span className="font-semibold text-gray-700">Change to Return:</span>
                      <span className={`font-bold ${changeDue >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        ₹{changeDue.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Embedded Dynamic UPI QR code */}
              {paymentMode === 'upi' && billSummary.netPayable > 0 && (
                <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 flex items-center gap-4">
                  <div className="bg-white p-2 rounded-xl shadow-xs shrink-0 border border-gray-100">
                    <QRCodeSVG value={upiLink} size={92} level="M" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-bold text-blue-950 flex items-center gap-1">
                      <Sparkles size={14} className="text-blue-600" />
                      Dynamic ₹{billSummary.netPayable} UPI QR
                    </p>
                    <p className="text-[11px] text-gray-600">
                      Scan via GPay, PhonePe, Paytm, BHIM to pay exact bill amount.
                    </p>
                    <p className="text-[10px] font-mono text-gray-500 truncate">
                      VPA: {pharmacy.upiId}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Summary & Bill Generation Card */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b pb-2">
                Bill Summary
              </h3>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Gross Total (MRP):</span>
                  <span className="font-semibold">₹{billSummary.grossAmount.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-emerald-700 font-medium">
                  <span className="flex items-center gap-1">
                    <Tag size={12} /> Total Discount Savings:
                  </span>
                  <span className="font-bold">-₹{billSummary.totalDiscount.toFixed(2)} ({billSummary.savingsPercent}%)</span>
                </div>

                {billSummary.roundOff !== 0 && (
                  <div className="flex justify-between text-gray-500 text-[11px]">
                    <span>Round off:</span>
                    <span>₹{billSummary.roundOff > 0 ? `+${billSummary.roundOff}` : billSummary.roundOff}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline">
                  <div>
                    <span className="text-sm font-bold text-gray-900 block">Net Payable Amount</span>
                    <span className="text-[10px] text-gray-500">Includes all applicable discounts</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold font-mono text-teal-800">
                    ₹{billSummary.netPayable}
                  </div>
                </div>
              </div>

              {/* Customer Savings Highlight */}
              {billSummary.totalDiscount > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Customer Saves ₹{billSummary.totalDiscount.toFixed(2)} on MRP!</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="button"
                disabled={items.length === 0 || savingBill}
                onClick={handleCreateBill}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {savingBill ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Saving Bill...
                  </>
                ) : (
                  <>
                    <Receipt size={18} /> Generate &amp; Print Bill (₹{billSummary.netPayable})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ---------------- POST BILL MODAL / RECEIPT PRINT VIEW ---------------- */}
        {completedBill && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto print:static print:bg-white print:p-0">
            <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-7 shadow-2xl space-y-4 my-auto max-h-[95vh] overflow-y-auto border border-gray-100 print:shadow-none print:border-none print:max-w-none print:p-0">
              
              {/* Modal Top Actions (Hidden when printing) */}
              <div className="flex items-center justify-between border-b pb-3 print:hidden">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 size={20} />
                  </span>
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Bill Generated Successfully!</h3>
                    <p className="text-[10px] text-gray-500 font-mono">Invoice: {completedBill.invoiceNo}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleStartNewBill}
                    className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 print:hidden">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer size={14} /> Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(completedBill)}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <MessageCircle size={14} /> Send WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handleStartNewBill}
                  className="col-span-2 sm:col-span-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={14} /> Next Bill
                </button>
              </div>

              {/* ---------------- THERMAL 80MM / A4 RECEIPT PREVIEW ---------------- */}
              <div className="border border-dashed border-gray-300 p-4 sm:p-5 rounded-2xl bg-gray-50/50 space-y-3 font-mono text-xs text-gray-800 print:bg-white print:border-none print:p-0">
                {/* Store Header */}
                <div className="text-center space-y-1 pb-2 border-b border-dashed border-gray-300">
                  <h2 className="font-bold text-base font-heading text-gray-900 tracking-tight uppercase">
                    {pharmacy.name}
                  </h2>
                  <p className="text-[11px] text-gray-600">{pharmacy.address}</p>
                  {pharmacy.phone && (
                    <p className="text-[10px] text-gray-500">
                      Ph: {pharmacy.phone}
                    </p>
                  )}
                </div>

                {/* Bill Metadata */}
                <div className="grid grid-cols-2 gap-1 text-[11px] pb-2 border-b border-dashed border-gray-300">
                  <div>
                    <span className="text-gray-500">Bill No: </span>
                    <strong className="text-gray-900">{completedBill.invoiceNo}</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500">Date: </span>
                    <span>{completedBill.date}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Patient / Cust: </span>
                    <strong>{completedBill.customerName}</strong>
                    {completedBill.customerPhone && ` (${completedBill.customerPhone})`}
                  </div>
                  {completedBill.doctorName && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Doctor: </span>
                      <span>{completedBill.doctorName}</span>
                    </div>
                  )}
                </div>

                {/* Items Table */}
                <div className="space-y-1 pb-2 border-b border-dashed border-gray-300">
                  <div className="flex justify-between font-bold text-[10px] text-gray-500 uppercase pb-1 border-b">
                    <span className="w-1/2">Item Description</span>
                    <span className="w-1/4 text-center">Qty × MRP</span>
                    <span className="w-1/4 text-right">Amount (₹)</span>
                  </div>
                  {completedBill.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-baseline text-[11px] py-0.5">
                      <div className="w-1/2 min-w-0 pr-1">
                        <p className="font-semibold text-gray-900 truncate">{it.name}</p>
                        {it.discountPercent > 0 && (
                          <span className="text-[9px] text-emerald-700">({it.discountPercent}% Off)</span>
                        )}
                      </div>
                      <div className="w-1/4 text-center text-gray-600 text-[10px]">
                        {it.quantity} × {it.effectiveRate}
                      </div>
                      <div className="w-1/4 text-right font-bold text-gray-900">
                        {it.netTotal.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Financial Summary */}
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between text-gray-600">
                    <span>Total MRP:</span>
                    <span>₹{completedBill.grossAmount.toFixed(2)}</span>
                  </div>
                  {completedBill.totalDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Total Savings:</span>
                      <span>-₹{completedBill.totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {completedBill.roundOff !== 0 && (
                    <div className="flex justify-between text-gray-500 text-[10px]">
                      <span>Round Off:</span>
                      <span>₹{completedBill.roundOff}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-gray-900 pt-1 border-t border-dashed border-gray-300">
                    <span>NET AMOUNT:</span>
                    <span>₹{completedBill.netPayable}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>Payment Mode:</span>
                    <span className="uppercase font-bold text-gray-800">{completedBill.paymentMode}</span>
                  </div>
                </div>

                {/* Embedded UPI QR for counter receipt */}
                {(completedBill.paymentMode === 'upi' || completedBill.paymentMode === 'credit') && (
                  <div className="pt-2 border-t border-dashed border-gray-300 text-center space-y-1">
                    <div className="bg-white p-2 rounded-lg inline-block border border-gray-200">
                      <QRCodeSVG value={upiLink} size={80} level="M" />
                    </div>
                    <p className="text-[10px] text-gray-500">Scan to Pay via UPI • {pharmacy.upiId}</p>
                  </div>
                )}

                {/* Footer Greeting */}
                <div className="text-center pt-2 border-t border-dashed border-gray-300 text-[10px] text-gray-500 space-y-0.5">
                  <p>🙏 धन्यवाद! Get Well Soon! / स्वस्थ रहें!</p>
                  <p className="text-[9px] text-gray-400">Computer Generated Retail Invoice</p>
                </div>
              </div>

              {/* Bottom Quick Reset */}
              <div className="pt-2 flex justify-end print:hidden">
                <button
                  type="button"
                  onClick={handleStartNewBill}
                  className="w-full py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Done • Next Customer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
