'use client';

import { DashboardLayout } from '@/components/layout';
import React, { useState, useEffect } from 'react';
import { Package, Eye, MapPin, CheckCircle, Clock, Truck, XCircle, Search } from 'lucide-react';

interface OrderItem {
  id: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Order {
  id: string;
  customerId: string;
  totalAmount: number;
  status: string;
  deliveryAddress?: string;
  notes?: string;
  createdAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    city?: string;
  };
  items: OrderItem[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const loadOrders = () => {
    setLoading(true);
    fetch('/api/orders')
      .then((res) => res.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
            <Clock className="w-3 h-3" /> Preparing
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
            <Package className="w-3 h-3" /> Ready for Pickup
          </span>
        );
      case 'out_for_delivery':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
            <Truck className="w-3 h-3" /> Out for Delivery
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
            <CheckCircle className="w-3 h-3" /> Delivered
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-semibold">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
            {status}
          </span>
        );
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  });

  return (
    <DashboardLayout>
      <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading text-gray-900">Doorstep Delivery Orders</h1>
            <p className="text-sm text-gray-500">Track and dispatch chronic medicine refill deliveries</p>
          </div>

          <div className="flex gap-2">
            {['all', 'preparing', 'out_for_delivery', 'delivered'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                  statusFilter === s
                    ? 'bg-teal-700 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading delivery orders...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="font-semibold text-gray-700">No orders found</p>
              <p className="text-xs text-gray-400 mt-1">Orders created from the Refills Center will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Order ID</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Delivery Address</th>
                    <th className="py-3.5 px-4">Medicines & Qty</th>
                    <th className="py-3.5 px-4">Total Value</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Update Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredOrders.map((o) => {
                    const orderDate = new Date(o.createdAt);
                    return (
                      <tr key={o.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-6">
                          <span className="font-mono text-xs font-bold text-teal-800">
                            #{o.id.slice(-6).toUpperCase()}
                          </span>
                          <p className="text-[10px] text-gray-400">
                            {orderDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-gray-900">{o.customer?.name}</p>
                          <p className="text-xs text-gray-400">{o.customer?.phone}</p>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="flex items-start gap-1 text-xs text-gray-600">
                            <MapPin className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
                            <span className="truncate">{o.deliveryAddress || 'Address on record'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            {o.items?.map((item, idx) => (
                              <p key={idx} className="text-xs text-gray-800 font-medium">
                                {item.medicineName} × {item.quantity}
                              </p>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          ₹{o.totalAmount}
                        </td>
                        <td className="py-3.5 px-4">
                          {getStatusBadge(o.status)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <select
                            value={o.status}
                            onChange={(e) => handleStatusChange(o.id, e.target.value)}
                            className="text-xs font-medium border border-gray-200 rounded-lg px-2.5 py-1 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                          >
                            <option value="preparing">Preparing</option>
                            <option value="ready">Ready</option>
                            <option value="out_for_delivery">Out for Delivery</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
