'use client';

import { DashboardLayout } from '@/components/layout';
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Pill, AlertTriangle, CheckCircle, X, Package, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

interface MedicineItem {
  id: string;
  name: string;
  genericName: string;
  category: string;
  packagingType: string;
  unitsPerPack: number;
  packsPerBox: number;
  mrp: number;
  currentStock: number;
  reorderLevel: number;
  isChronicMed: boolean;
  margItemCode?: string;
  manufacturer?: string;
  saltComposition?: string;
}

export default function MedicinesPage() {
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [chronicOnly, setChronicOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMedicines, setTotalMedicines] = useState(0);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // New Medicine Form State
  const [formData, setFormData] = useState({
    name: '',
    genericName: '',
    category: 'Diabetes',
    manufacturer: '',
    packagingType: 'strip',
    unitsPerPack: 10,
    packsPerBox: 10,
    mrp: 50.0,
    currentStock: 100,
    reorderLevel: 30,
    isChronicMed: true,
    margItemCode: '',
  });

  const loadMedicines = (targetPage = page, query = search, cat = category, chronic = chronicOnly) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(targetPage),
      limit: '50',
    });
    if (query.trim()) params.set('q', query.trim());
    if (cat && cat !== 'All') params.set('category', cat);
    if (chronic) params.set('chronic', 'true');

    fetch(`/api/medicines?${params.toString()}`)
      .then((res) => res.json())
      .then((resData) => {
        if (Array.isArray(resData)) {
          setMedicines(resData);
          setTotalMedicines(resData.length);
          setTotalPages(1);
        } else if (resData && Array.isArray(resData.data)) {
          setMedicines(resData.data);
          setTotalMedicines(resData.total || 0);
          setTotalPages(resData.totalPages || 1);
          setPage(resData.page || targetPage);
        } else {
          setMedicines([]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadMedicines(1, search, category, chronicOnly);
  }, [category, chronicOnly]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      loadMedicines(1, val, category, chronicOnly);
    }, 300);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      loadMedicines(newPage, search, category, chronicOnly);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          unitsPerPack: Number(formData.unitsPerPack),
          packsPerBox: Number(formData.packsPerBox),
          mrp: parseFloat(String(formData.mrp)),
          currentStock: Number(formData.currentStock),
          reorderLevel: Number(formData.reorderLevel),
          margItemCode: formData.margItemCode || `MARG-${Date.now()}`,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setFormData({
          name: '',
          genericName: '',
          category: 'Diabetes',
          manufacturer: '',
          packagingType: 'strip',
          unitsPerPack: 10,
          packsPerBox: 10,
          mrp: 50.0,
          currentStock: 100,
          reorderLevel: 30,
          isChronicMed: true,
          margItemCode: '',
        });
        loadMedicines(1, search, category, chronicOnly);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const categories = ['All', 'Diabetes', 'BP', 'Thyroid', 'Cholesterol', 'Infant Milk', 'Heart', 'Respiratory', 'Gastric', 'Tablet / Capsule', 'Syrup'];

  return (
    <DashboardLayout>
      <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-gray-900">Pharmaceutical Inventory &amp; Stock</h1>
              <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {totalMedicines.toLocaleString()} items
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Live shop stock, pack sizes, MRP, and chronic classifications synced with MARG ERP
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto justify-center bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus size={18} /> Add Medicine
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex gap-2 overflow-x-auto pb-1 w-full md:w-auto scrollbar-none">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCategory(c);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  category === c
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={chronicOnly}
                onChange={(e) => {
                  setChronicOnly(e.target.checked);
                  setPage(1);
                }}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <span>Chronic Meds Only</span>
            </label>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search name, salt, company, code..."
                className="pl-9 pr-4 py-2 text-xs bg-white border border-gray-200 rounded-xl w-full focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading medicines...</div>
          ) : medicines.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Pill className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="font-semibold text-gray-700">No medicines found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your search terms or filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <th className="py-3.5 px-6">Medicine &amp; Brand</th>
                      <th className="py-3.5 px-4">Salt / Generic</th>
                      <th className="py-3.5 px-4">Condition</th>
                      <th className="py-3.5 px-4">Packaging Size</th>
                      <th className="py-3.5 px-4">MRP (₹)</th>
                      <th className="py-3.5 px-4">Stock In Hand</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {medicines.map((m) => {
                      let statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3" /> In Stock
                        </span>
                      );

                      if (m.currentStock === 0) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            <AlertTriangle className="w-3 h-3" /> Out of Stock
                          </span>
                        );
                      } else if (m.currentStock <= m.reorderLevel) {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Low Stock
                          </span>
                        );
                      }

                      return (
                        <tr key={m.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3.5 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                                <Pill className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 leading-tight">{m.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-gray-400">{m.manufacturer || 'Indian Pharma'}</span>
                                  {m.margItemCode && (
                                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.2 rounded">
                                      {m.margItemCode}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-gray-600 text-xs font-medium max-w-[200px] truncate">
                            {m.genericName || m.saltComposition || '-'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                              m.category === 'Infant Milk' ? 'bg-pink-50 text-pink-700 border border-pink-200' :
                              m.category === 'Diabetes' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                              m.category === 'Blood Pressure' || m.category === 'BP' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              m.category === 'Thyroid' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                              'bg-gray-50 text-gray-700 border border-gray-200'
                            }`}>
                              {m.category}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="text-xs font-semibold text-gray-800">
                              {m.unitsPerPack} {m.packagingType === 'tin' ? 'g Tin' : m.packagingType === 'bottle' ? 'tabs/bottle' : 'tabs/strip'}
                            </p>
                            <p className="text-[10px] text-gray-400">{m.packsPerBox} per box</p>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-gray-900 text-sm">
                            ₹{m.mrp}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-gray-800 text-sm">{m.currentStock}</span>
                            <span className="text-xs text-gray-400 ml-1">units</span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {statusBadge}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-500">
                <div>
                  Showing <strong className="text-gray-900">{(page - 1) * 50 + 1}</strong> to{' '}
                  <strong className="text-gray-900">{Math.min(page * 50, totalMedicines)}</strong> of{' '}
                  <strong className="text-gray-900">{totalMedicines.toLocaleString()}</strong> products
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <span className="px-3 py-1 font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg">
                    Page {page} of {totalPages}
                  </span>

                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Add Medicine Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-lg text-gray-900 font-heading">Add Medicine &amp; Packaging Info</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddMedicine} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Brand Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Glycomet 500mg"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Generic / Salt</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Metformin HCl"
                      value={formData.genericName}
                      onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Category / Condition</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
                    >
                      <option value="Diabetes">Diabetes</option>
                      <option value="Blood Pressure">Blood Pressure</option>
                      <option value="Thyroid">Thyroid</option>
                      <option value="Cholesterol">Cholesterol</option>
                      <option value="Infant Milk">Infant Milk / Baby Formula</option>
                      <option value="Heart">Heart</option>
                      <option value="Gastric">Gastric</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Manufacturer</label>
                    <input
                      type="text"
                      placeholder="e.g. USV Ltd"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tablets Per Strip</label>
                    <input
                      type="number"
                      required
                      value={formData.unitsPerPack}
                      onChange={(e) => setFormData({ ...formData, unitsPerPack: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Strips Per Box</label>
                    <input
                      type="number"
                      value={formData.packsPerBox}
                      onChange={(e) => setFormData({ ...formData, packsPerBox: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">MRP (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.mrp}
                      onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Stock (Units)</label>
                    <input
                      type="number"
                      value={formData.currentStock}
                      onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">MARG Item Code (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. M0012"
                      value={formData.margItemCode}
                      onChange={(e) => setFormData({ ...formData, margItemCode: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isChronicMed}
                      onChange={(e) => setFormData({ ...formData, isChronicMed: e.target.checked })}
                      className="w-4 h-4 text-teal-600 rounded"
                    />
                    <span className="text-xs text-gray-700 font-medium">Flag as chronic medication (for auto-refill program)</span>
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
                    Save Medicine
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
