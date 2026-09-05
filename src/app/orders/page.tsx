'use client';

import { DashboardLayout } from '@/components/layout';
import React, { useState, useEffect } from 'react';
import {
  Package, Eye, MapPin, CheckCircle, Clock, Truck, XCircle, Search,
  MessageCircle, IndianRupee, Banknote, Smartphone, X, QrCode, CheckCircle2
} from 'lucide-react';
import { renderTemplate, DEFAULT_TEMPLATES } from '@/lib/templates';
import { QRCodeSVG } from 'qrcode.react';


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
  paymentMode?: string;
  paymentStatus?: string;
  amountCollected?: number;
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
  const [settings, setSettings] = useState<any>(null);

  // Payment modal state
  const [paymentModal, setPaymentModal] = useState<Order | null>(null);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online'>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const loadOrders = () => {
    setLoading(true);
    fetch('/api/orders')
      .then((res) => res.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Open payment modal
  const openPaymentModal = (order: Order) => {
    setPaymentModal(order);
    setPaymentMode('cash');
    setPaymentAmount(String(order.totalAmount || 0));
    setPaymentConfirmed(false);
  };

  // Confirm payment collection
  const handleConfirmPayment = async () => {
    if (!paymentModal) return;
    setPaymentSaving(true);

    try {
      const res = await fetch(`/api/orders/${paymentModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMode: paymentMode,
          paymentStatus: 'collected',
          amountCollected: parseFloat(paymentAmount) || paymentModal.totalAmount,
        }),
      });

      if (res.ok) {
        setPaymentConfirmed(true);
        // Update local state
        setOrders(orders.map((o) =>
          o.id === paymentModal.id
            ? {
                ...o,
                paymentMode: paymentMode,
                paymentStatus: 'collected',
                amountCollected: parseFloat(paymentAmount) || o.totalAmount,
              }
            : o
        ));
        setTimeout(() => {
          setPaymentModal(null);
          setPaymentConfirmed(false);
        }, 1500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleSendWhatsAppDispatch = (order: Order) => {
    const medNames = order.items?.map((i) => `${i.medicineName} (${i.quantity})`).join(', ') || 'Prescription Order';
    const cleanDigits = (order.customer?.phone || '').replace(/[^0-9]/g, '');
    const phone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;

    const template = settings?.outForDeliveryTemplate || DEFAULT_TEMPLATES.outForDeliveryTemplate;
    const message = renderTemplate(template, {
      name: order.customer?.name || 'Valued Customer',
      medicine: medNames,
      days: 'Dispatched',
      date: 'Today',
      pharmacy: settings?.pharmacyName || 'MedRefill Chemist',
      phone: settings?.phone || '',
      address: order.deliveryAddress || '',
    });

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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

  const getPaymentBadge = (order: Order) => {
    if (order.paymentStatus === 'collected') {
      if (order.paymentMode === 'online') {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-bold">
            <Smartphone className="w-3 h-3" /> UPI ₹{order.amountCollected || order.totalAmount}
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-[10px] font-bold">
          <Banknote className="w-3 h-3" /> Cash ₹{order.amountCollected || order.totalAmount}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-[10px] font-bold">
        <IndianRupee className="w-3 h-3" /> Pending
      </span>
    );
  };

  // Generate UPI deep link for QR code
  const generateUpiLink = (amount: string) => {
    const upiIdVal = settings?.upiId || '';
    const payeeName = settings?.upiPayeeName || settings?.pharmacyName || 'Pharmacy';
    const orderId = paymentModal?.id?.slice(-6)?.toUpperCase() || 'ORDER';
    return `upi://pay?pa=${encodeURIComponent(upiIdVal)}&pn=${encodeURIComponent(payeeName)}&am=${amount || '0'}&cu=INR&tn=Order-${orderId}`;
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  });

  const canCollectPayment = (order: Order) => {
    return (
      order.paymentStatus !== 'collected' &&
      ['out_for_delivery', 'delivered', 'ready'].includes(order.status)
    );
  };

  return (
    <DashboardLayout>
      <div className="p-2 md:p-4 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-heading text-gray-900">Doorstep Delivery Orders</h1>
            <p className="text-xs sm:text-sm text-gray-500">Track and dispatch chronic medicine refill deliveries</p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 w-full sm:w-auto">
            {['all', 'preparing', 'out_for_delivery', 'delivered'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
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
              <table className="w-full min-w-[850px] text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Order ID</th>
                    <th className="py-3.5 px-4">Customer</th>
                    <th className="py-3.5 px-4">Delivery Address</th>
                    <th className="py-3.5 px-4">Medicines & Qty</th>
                    <th className="py-3.5 px-4">Total</th>
                    <th className="py-3.5 px-4">Payment</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
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
                          {getPaymentBadge(o)}
                        </td>
                        <td className="py-3.5 px-4">
                          {getStatusBadge(o.status)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {/* Collect Payment Button */}
                            {canCollectPayment(o) && (
                              <button
                                type="button"
                                onClick={() => openPaymentModal(o)}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                                title="Collect Payment"
                              >
                                <IndianRupee className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Pay</span>
                              </button>
                            )}

                            {/* WhatsApp Button */}
                            <button
                              type="button"
                              onClick={() => handleSendWhatsAppDispatch(o)}
                              title="Send WhatsApp Out for Delivery Alert to Customer"
                              className="px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">WA</span>
                            </button>

                            {/* Status Dropdown */}
                            <select
                              value={o.status}
                              onChange={(e) => handleStatusChange(o.id, e.target.value)}
                              className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
                            >
                              <option value="preparing">Preparing</option>
                              <option value="ready">Ready</option>
                              <option value="out_for_delivery">Out for Delivery</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
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

      {/* ============ PAYMENT COLLECTION MODAL ============ */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900 font-heading flex items-center gap-2">
                  <IndianRupee className="w-5 h-5 text-indigo-600" />
                  Collect Payment
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Order #{paymentModal.id.slice(-6).toUpperCase()} • {paymentModal.customer?.name}
                </p>
              </div>
              <button
                onClick={() => setPaymentModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Payment Confirmed State */}
            {paymentConfirmed ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-green-800">Payment Collected!</h3>
                <p className="text-sm text-gray-500">
                  ₹{paymentAmount} via {paymentMode === 'cash' ? 'Cash' : 'UPI Online'}
                </p>
              </div>
            ) : (
              <>
                {/* Order Summary */}
                <div className="px-6 py-4 bg-gray-50/80 border-b border-gray-100">
                  <div className="space-y-1.5">
                    {paymentModal.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-gray-700">
                        <span className="font-medium">{item.medicineName} × {item.quantity}</span>
                        <span className="font-semibold">₹{item.totalPrice}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                    <span className="text-sm font-bold text-gray-900">Total Amount</span>
                    <span className="text-lg font-extrabold text-gray-900">₹{paymentModal.totalAmount}</span>
                  </div>
                </div>

                {/* Payment Mode Selection */}
                <div className="px-6 py-5 space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-3">Select Payment Mode</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMode('cash')}
                        className={`p-4 rounded-2xl border-2 text-center transition-all cursor-pointer ${
                          paymentMode === 'cash'
                            ? 'border-green-500 bg-green-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <Banknote className={`w-8 h-8 mx-auto mb-2 ${
                          paymentMode === 'cash' ? 'text-green-600' : 'text-gray-400'
                        }`} />
                        <p className={`text-sm font-bold ${
                          paymentMode === 'cash' ? 'text-green-800' : 'text-gray-600'
                        }`}>Cash</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Collect cash from customer</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMode('online')}
                        className={`p-4 rounded-2xl border-2 text-center transition-all cursor-pointer ${
                          paymentMode === 'online'
                            ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <Smartphone className={`w-8 h-8 mx-auto mb-2 ${
                          paymentMode === 'online' ? 'text-indigo-600' : 'text-gray-400'
                        }`} />
                        <p className={`text-sm font-bold ${
                          paymentMode === 'online' ? 'text-indigo-800' : 'text-gray-600'
                        }`}>Online (UPI)</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Show QR code to customer</p>
                      </button>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Amount to Collect (₹)
                    </label>
                    <input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full px-4 py-3 text-lg font-bold border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-center"
                      placeholder="Enter amount"
                      min="0"
                      step="1"
                    />
                  </div>

                  {/* QR Code for Online */}
                  {paymentMode === 'online' && (
                    <div className="space-y-3">
                      {settings?.upiId && settings.upiId.includes('@') ? (
                        <div className="bg-white rounded-2xl border border-indigo-200 p-6 flex flex-col items-center gap-3">
                          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                            Scan to Pay via UPI
                          </p>
                          <QRCodeSVG
                            value={generateUpiLink(paymentAmount)}
                            size={200}
                            bgColor="#ffffff"
                            fgColor="#1e1b4b"
                            level="M"
                            includeMargin={false}
                          />
                          <div className="text-center space-y-1">
                            <p className="text-sm font-extrabold text-gray-900">₹{paymentAmount || '0'}</p>
                            <p className="text-[11px] font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                              {settings.upiId}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {settings.upiPayeeName || settings.pharmacyName || 'Pharmacy'}
                            </p>
                          </div>
                          <p className="text-[10px] text-gray-400 text-center">
                            Works with GPay, PhonePe, Paytm, BHIM & all UPI apps
                          </p>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center space-y-2">
                          <QrCode className="w-8 h-8 text-amber-500 mx-auto" />
                          <p className="text-xs font-bold text-amber-800">UPI ID Not Configured</p>
                          <p className="text-[11px] text-amber-600">
                            Go to Settings → Payment & UPI Configuration to add your UPI ID first.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Confirm Button */}
                  <button
                    type="button"
                    onClick={handleConfirmPayment}
                    disabled={paymentSaving || !paymentAmount || parseFloat(paymentAmount) <= 0}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                      paymentMode === 'cash'
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {paymentSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : paymentMode === 'cash' ? (
                      <>
                        <Banknote className="w-4 h-4" />
                        <span>Confirm Cash Received — ₹{paymentAmount}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Customer Has Paid — ₹{paymentAmount}</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
