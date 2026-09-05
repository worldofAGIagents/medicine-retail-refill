'use client';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout';
import Link from 'next/link';
import {
  Users, RefreshCw, ClipboardList, Package, Plus, Upload,
  ArrowRight, Bell, Sparkles, UserPlus, Heart, CheckCircle2, TrendingUp
} from 'lucide-react';
import { OnboardPatientModal } from '@/components/OnboardPatientModal';

interface DashboardStats {
  totalCustomers: number;
  upcomingRefills: number;
  activePrescriptions: number;
  pendingDeliveries: number;
}

interface RefillItem {
  id: string;
  customerName: string;
  medicineName: string;
  dailyDosage: number;
  daysRemaining: number;
  urgency: string;
  nextRefillDate: string;
}

interface RecentCustomer {
  id: string;
  name: string;
  phone: string;
  primaryCondition?: string | null;
  prescriptions?: Array<{
    medicine: { name: string; category: string };
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0, upcomingRefills: 0,
    activePrescriptions: 0, pendingDeliveries: 0,
  });
  const [refills, setRefills] = useState<RefillItem[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardModal, setShowOnboardModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, refillsRes, customersRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/refills'),
        fetch('/api/customers'),
      ]);
      if (statsRes.ok) {
        const s = await statsRes.json();
        setStats({
          totalCustomers: s.totalCustomers || 0,
          upcomingRefills: s.upcomingRefills || s.upcomingRefillsCount || 0,
          activePrescriptions: s.activePrescriptions || s.activePrescriptionsCount || 0,
          pendingDeliveries: s.pendingDeliveries || 0,
        });
      }
      if (refillsRes.ok) {
        const data = await refillsRes.json();
        const mapped: RefillItem[] = (Array.isArray(data) ? data.slice(0, 6) : []).map((item: any) => ({
          id: item.id,
          customerName: item.customer?.name || item.customerName || 'Customer',
          medicineName: item.medicine?.name || item.medicineName || 'Medicine',
          dailyDosage: item.dailyDosage || 1,
          daysRemaining: item.refillCalc?.daysRemaining ?? item.daysRemaining ?? 0,
          urgency: item.refillCalc?.urgency || item.urgency || 'ok',
          nextRefillDate: item.refillCalc?.nextRefillDate || item.nextRefillDate || '',
        }));
        setRefills(mapped);
      }
      if (customersRes.ok) {
        const custData = await customersRes.json();
        if (Array.isArray(custData)) {
          setRecentCustomers(custData.slice(0, 5));
        }
      }
    } catch (e) {
      console.error('Failed to fetch dashboard data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDashboardRemind = async (refill: RefillItem) => {
    try {
      const res = await fetch('/api/notifications/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prescriptionId: refill.id,
          customerName: refill.customerName,
          medicineName: refill.medicineName,
          daysRemaining: refill.daysRemaining,
          refillDate: refill.nextRefillDate,
        }),
      });
      const data = await res.json();
      if (data.success && data.waMeUrl) {
        window.open(data.waMeUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const statCards = [
    { label: 'Total Chronic Customers', value: stats.totalCustomers, icon: Users, color: 'bg-blue-500', lightBg: 'bg-blue-50', textColor: 'text-blue-700', change: '+12 this month' },
    { label: 'Upcoming Refills', value: stats.upcomingRefills, icon: RefreshCw, color: 'bg-amber-500', lightBg: 'bg-amber-50', textColor: 'text-amber-700', change: 'due this week' },
    { label: 'Active Prescriptions', value: stats.activePrescriptions, icon: ClipboardList, color: 'bg-teal-500', lightBg: 'bg-teal-50', textColor: 'text-teal-700', change: '' },
    { label: 'Pending Deliveries', value: stats.pendingDeliveries, icon: Package, color: 'bg-red-500', lightBg: 'bg-red-50', textColor: 'text-red-700', change: 'needs attention' },
  ];

  function getUrgencyBadge(urgency: string) {
    const styles: Record<string, string> = {
      overdue: 'bg-red-100 text-red-700 border-red-200',
      urgent: 'bg-red-100 text-red-700 border-red-200',
      due_soon: 'bg-amber-100 text-amber-700 border-amber-200',
      ok: 'bg-green-100 text-green-700 border-green-200',
      future: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    const labels: Record<string, string> = {
      overdue: 'Overdue', urgent: 'Urgent', due_soon: 'Due Soon', ok: 'OK', future: 'Future',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[urgency] || styles.future}`}>
        {labels[urgency] || urgency}
      </span>
    );
  }

  return (
    <DashboardLayout>
      {/* Top Banner / Onboard Trigger */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-gray-900">Manoj Medical Hall</h1>
            <span className="text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
              📍 Sarfuddinpur, Muzaffarpur (843118)
            </span>
            <span className="text-[11px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
              10–20 KM Village Delivery
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Village Chronic Patient Refill Cycles, Doorstep Medicine Delivery &amp; WhatsApp Alerts
          </p>
        </div>
        <button
          onClick={() => setShowOnboardModal(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all hover:shadow-md cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          + Onboard Patient
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1 font-heading">
                  {loading ? '—' : card.value}
                </p>
                {card.change && (
                  <p className={`text-xs mt-1 ${card.textColor} font-medium flex items-center gap-1`}>
                    <TrendingUp className="w-3 h-3" />
                    {card.change}
                  </p>
                )}
              </div>
              <div className={`${card.lightBg} p-3 rounded-xl`}>
                <card.icon className={`w-5 h-5 ${card.textColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Upcoming Refills Table - 2/3 width */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 font-heading">Upcoming Refills</h3>
              <p className="text-xs sm:text-sm text-gray-500">Chronic medicine refills sorted by urgency</p>
            </div>
            <Link href="/refills" className="text-xs sm:text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px]">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Medicine</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Daily Dose</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Days Left</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading refill data...</td></tr>
                ) : refills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 px-4">
                      <div className="max-w-sm mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
                          <Heart className="w-6 h-6" />
                        </div>
                        <h4 className="font-semibold text-gray-800 text-sm">No Upcoming Refills Yet</h4>
                        <p className="text-xs text-gray-500">
                          Enrol your regular patients with BP, Diabetes, Thyroid or baby food to automatically predict and schedule their next refills.
                        </p>
                        <button
                          onClick={() => setShowOnboardModal(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Onboard First Patient
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  refills.map((refill) => (
                    <tr key={refill.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">
                            {(refill.customerName || 'Customer').split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{refill.customerName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-gray-700">{refill.medicineName}</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm text-gray-600">{refill.dailyDosage}/day</span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-sm font-semibold ${refill.daysRemaining <= 2 ? 'text-red-600' : refill.daysRemaining <= 5 ? 'text-amber-600' : 'text-gray-700'}`}>
                          {refill.daysRemaining <= 0 ? `${Math.abs(refill.daysRemaining)}d overdue` : `${refill.daysRemaining} days`}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {getUrgencyBadge(refill.urgency)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleDashboardRemind(refill)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <Bell className="w-3 h-3" />
                          WhatsApp
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-base font-semibold text-gray-900 mb-4 font-heading">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => setShowOnboardModal(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-teal-50 text-teal-800 hover:bg-teal-100 transition-colors group text-left cursor-pointer border border-teal-100"
              >
                <div className="p-2 bg-teal-600 text-white rounded-lg group-hover:bg-teal-700 transition-colors">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    Onboard Patient <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </p>
                  <p className="text-xs text-teal-700">Patient + Condition + Medicine</p>
                </div>
              </button>

              <Link href="/medicines" className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors group">
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Medicine Catalog</p>
                  <p className="text-xs text-blue-600">Browse 9,259 shop products</p>
                </div>
              </Link>

              <Link href="/import" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors group">
                <div className="p-2 bg-gray-200 rounded-lg group-hover:bg-gray-300 transition-colors">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Import from MARG</p>
                  <p className="text-xs text-gray-500">Sync Excel stock &amp; prices</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Enrolled Chronic Patients */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 font-heading">Enrolled Patients</h3>
              <Link href="/customers" className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                View all
              </Link>
            </div>
            {recentCustomers.length === 0 ? (
              <div className="text-center py-6 px-3 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                <p className="text-xs font-semibold text-gray-700">No Patients Enrolled</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Click &quot;+ Onboard Patient&quot; to enrol your first repeat customer</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentCustomers.map((cust) => (
                  <div key={cust.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{cust.name}</p>
                      <p className="text-xs text-gray-500">{cust.phone}</p>
                    </div>
                    {cust.primaryCondition && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-100">
                        {cust.primaryCondition}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Auto-Learning Banner */}
          <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl p-4 border border-teal-100 text-teal-900">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-teal-600 text-white rounded-lg shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-1">
                <p className="font-bold text-teal-950">Dynamic Catalog Learning</p>
                <p className="text-teal-800 leading-relaxed">
                  Whenever you onboard a patient with a condition (e.g. Blood Pressure, Diabetes), the shop catalog automatically categorizes that medicine as chronic.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Onboard Patient Modal */}
      <OnboardPatientModal
        isOpen={showOnboardModal}
        onClose={() => setShowOnboardModal(false)}
        onSuccess={() => fetchData()}
      />
    </DashboardLayout>
  );
}
