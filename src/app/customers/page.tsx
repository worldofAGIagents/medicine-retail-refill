'use client';

import { DashboardLayout } from '@/components/layout';
import React, { useState, useEffect } from 'react';
import { Search, Plus, Phone, MapPin, Pill, X, Check, Eye } from 'lucide-react';

interface PrescriptionWithMedicine {
  id: string;
  dailyDosage: number;
  nextRefillDate: string | null;
  medicine: {
    name: string;
    category: string;
    genericName: string;
  };
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  city?: string;
  whatsappEnabled: boolean;
  prescriptions: PrescriptionWithMedicine[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  // New Customer Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: 'Noida',
    whatsappEnabled: true,
    consentGiven: true,
  });

  const loadCustomers = () => {
    setLoading(true);
    fetch('/api/customers')
      .then((res) => res.json())
      .then((data) => {
        setCustomers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({
          name: '',
          phone: '',
          email: '',
          address: '',
          city: 'Noida',
          whatsappEnabled: true,
          consentGiven: true,
        });
        loadCustomers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const categories = ['All', 'Diabetes', 'BP', 'Thyroid', 'Cholesterol', 'Infant Milk'];

  // Filter customers by search and condition
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (category === 'All') return true;

    // Check if customer has any prescription with this category
    const catQuery = category.toLowerCase();
    return c.prescriptions?.some((p) => {
      const medCat = p.medicine?.category?.toLowerCase() || '';
      if (catQuery === 'bp') return medCat.includes('bp') || medCat.includes('blood pressure');
      return medCat.includes(catQuery);
    });
  });

  return (
    <DashboardLayout>
      <div className="p-2 md:p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-gray-900">Chronic Medicine Customers</h1>
            <p className="text-xs sm:text-sm text-gray-500">Manage repeat customers for diabetes, BP, thyroid, and cholesterol refills</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto justify-center bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus size={18} /> Add Customer
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-start md:items-center">
          <div className="flex gap-2 overflow-x-auto pb-1 w-full md:w-auto">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  category === c
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by name, phone, address..."
              className="pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Customer Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading customers...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Pill className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-base font-medium text-gray-600">No customers found</p>
              <p className="text-xs text-gray-400 mt-1">Try changing your search or category filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Customer Name</th>
                    <th className="py-3.5 px-4">Contact Info</th>
                    <th className="py-3.5 px-4">Active Medicines</th>
                    <th className="py-3.5 px-4 text-center">Prescriptions</th>
                    <th className="py-3.5 px-4">Next Refill Date</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCustomers.map((c) => {
                    const initials = c.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    // Find nearest refill date
                    let nearestRefillDateStr: string | null = null;
                    c.prescriptions?.forEach((p) => {
                      if (p.nextRefillDate) {
                        if (!nearestRefillDateStr || new Date(p.nextRefillDate) < new Date(nearestRefillDateStr)) {
                          nearestRefillDateStr = p.nextRefillDate;
                        }
                      }
                    });

                    return (
                      <tr key={c.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{c.name}</p>
                              {c.city && <p className="text-xs text-gray-400">{c.city}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            <span>{c.phone}</span>
                            {c.whatsappEnabled && (
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.2 rounded font-semibold">
                                WA
                              </span>
                            )}
                          </div>
                          {c.address && (
                            <div className="flex items-center gap-1 text-xs text-gray-400 truncate max-w-xs mt-0.5">
                              <MapPin className="w-3 h-3 text-gray-300 shrink-0" />
                              <span className="truncate">{c.address}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {c.prescriptions && c.prescriptions.length > 0 ? (
                              c.prescriptions.map((p, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-teal-50 text-teal-700 border border-teal-100"
                                >
                                  {p.medicine?.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-gray-400">No active prescriptions</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-800 text-xs font-bold">
                            {c.prescriptions?.length || 0}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {nearestRefillDateStr ? (
                            <div>
                              <p className="text-xs font-semibold text-gray-800">
                                {new Date(nearestRefillDateStr).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                              <span className="text-[10px] text-teal-600 font-medium">Auto-Refill Active</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setViewCustomer(c)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
            <span>Showing {filteredCustomers.length} chronic customers</span>
          </div>
        </div>

        {/* View Customer Modal */}
        {viewCustomer && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-base">
                    {viewCustomer.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{viewCustomer.name}</h3>
                    <p className="text-xs text-gray-500">{viewCustomer.phone}</p>
                  </div>
                </div>
                <button onClick={() => setViewCustomer(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold">Delivery Address</span>
                  <p className="text-gray-700 font-medium">{viewCustomer.address || 'Address not registered'}, {viewCustomer.city}</p>
                </div>

                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold">Chronic Prescriptions ({viewCustomer.prescriptions?.length || 0})</span>
                  <div className="mt-2 space-y-2">
                    {viewCustomer.prescriptions?.map((p, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">{p.medicine?.name}</p>
                          <p className="text-xs text-gray-500">{p.medicine?.genericName} • {p.dailyDosage} tablet/day</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-teal-700">
                            {p.nextRefillDate ? new Date(p.nextRefillDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No date'}
                          </span>
                          <p className="text-[10px] text-gray-400">Refill Target</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end">
                <button
                  onClick={() => setViewCustomer(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Customer Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-lg text-gray-900 font-heading">Add New Chronic Patient</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddCustomer} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Patient Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Chandra"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile / WhatsApp Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Delivery Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Flat 302, Green Valley Apartments"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      placeholder="patient@gmail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.whatsappEnabled}
                      onChange={(e) => setFormData({ ...formData, whatsappEnabled: e.target.checked })}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <span className="text-xs text-gray-700 font-medium">Send automatic refill reminders via WhatsApp</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.consentGiven}
                      onChange={(e) => setFormData({ ...formData, consentGiven: e.target.checked })}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <span className="text-xs text-gray-700 font-medium">Customer has consented to refill reminders (DPDPA 2023)</span>
                  </label>
                </div>

                <div className="pt-3 border-t flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                  >
                    Save Customer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
