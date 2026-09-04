'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pill, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams?.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      // Success, redirect to dashboard or intended page
      router.push(redirectPath);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during login');
      setLoading(false);
    }
  };

  const handleUseDemo = () => {
    setEmail('admin@medrefill.in');
    setPassword('pharmacy123');
    setErrorMsg('');
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Sign in to your account</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Authorized pharmacy staff only. Data is protected.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Email Address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="email"
              required
              placeholder="name@pharmacy.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {loading ? (
            <span>Signing In...</span>
          ) : (
            <>
              <span>Access Dashboard</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Quick Demo Helper */}
      <div className="pt-4 border-t border-gray-100">
        <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="text-xs">
            <p className="font-semibold text-teal-900 flex items-center gap-1">
              <ShieldCheck size={14} className="text-teal-600" />
              Default Admin Login
            </p>
            <p className="text-[11px] text-teal-700 font-mono mt-0.5">
              admin@medrefill.in / pharmacy123
            </p>
          </div>
          <button
            type="button"
            onClick={handleUseDemo}
            className="text-xs bg-white border border-teal-200 hover:bg-teal-100 text-teal-800 px-2.5 py-1 rounded-lg font-semibold transition-colors shrink-0"
          >
            Auto-fill
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-teal-500/20">
            <Pill className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-white tracking-tight">
            MedRefill Portal
          </h1>
          <p className="text-xs sm:text-sm text-teal-200/80">
            Secure Pharmacist Access &amp; Chronic Refill Dispatch
          </p>
        </div>

        {/* Login Form wrapped in Suspense for useSearchParams */}
        <Suspense fallback={
          <div className="bg-white rounded-3xl p-8 shadow-2xl text-center text-gray-400">
            Loading login form...
          </div>
        }>
          <LoginForm />
        </Suspense>

        {/* Footer */}
        <p className="text-center text-xs text-teal-300/60">
          MedRefill • Chronic Refill &amp; Retail MARG ERP Integration
        </p>
      </div>
    </div>
  );
}
