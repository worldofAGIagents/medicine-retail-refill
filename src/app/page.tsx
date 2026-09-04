'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout';
import Link from 'next/link';
import {
  Users, RefreshCw, ClipboardList, Package, Plus, Upload,
  ArrowRight, AlertTriangle, TrendingUp, Bell
} from 'lucide-react';

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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0, upcomingRefills: 0,
    activePrescriptions: 0, pendingDeliveries: 0,
  });
  const [refills, setRefills] = useState<RefillItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, refillsRes] = await Promise.all([
          fetch('/api/dashboard'),
          fetch('/api/refills'),
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
      } catch (e) {
        console.error('Failed to fetch dashboard data', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

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
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading...</td></tr>
                ) : refills.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No upcoming refills</td></tr>
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
              <Link href="/customers?action=add" className="flex items-center gap-3 p-3 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors group">
                <div className="p-2 bg-teal-100 rounded-lg group-hover:bg-teal-200 transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Add New Customer</p>
                  <p className="text-xs text-teal-600">Register a chronic patient</p>
                </div>
              </Link>
              <Link href="/prescriptions?action=add" className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors group">
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">New Prescription</p>
                  <p className="text-xs text-blue-600">Track a medicine refill</p>
                </div>
              </Link>
              <Link href="/import" className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors group">
                <div className="p-2 bg-gray-200 rounded-lg group-hover:bg-gray-300 transition-colors">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Import from MARG</p>
                  <p className="text-xs text-gray-500">Sync your ERP data</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Today's Deliveries */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-base font-semibold text-gray-900 mb-4 font-heading">Today&apos;s Deliveries</h3>
            <div className="space-y-3">
              {[
                { name: 'Amit Kumar', medicine: 'Metformin 500mg', status: 'Preparing', color: 'bg-amber-400' },
                { name: 'Sunita Devi', medicine: 'Atorvastatin 10mg', status: 'Out for Delivery', color: 'bg-blue-400' },
                { name: 'Kavita Singh', medicine: 'Glimepiride 2mg', status: 'Delivered', color: 'bg-green-400' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${item.color}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.medicine}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-500">{item.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Low Stock Alert */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-red-100">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <h3 className="text-base font-semibold text-gray-900 font-heading">Low Stock Alert</h3>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Glycomet 500mg', stock: 25, level: 'Low' },
                { name: 'Pan-D 40mg', stock: 8, level: 'Critical' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.stock} units left</p>
                  </div>
                  <button className="text-xs font-semibold text-red-600 hover:text-red-700 px-3 py-1 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                    Reorder
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
