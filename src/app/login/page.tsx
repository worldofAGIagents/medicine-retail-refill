'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pill, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, User, CheckCircle2 } from 'lucide-react';

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams?.get('redirect') || '/';

  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('pharmacist');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during login');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          role: regRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      setSuccessMsg('Account created successfully! Redirecting...');
      setTimeout(() => {
        router.push(redirectPath);
        router.refresh();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during registration');
      setLoading(false);
    }
  };

  const handleFillAgent = () => {
    setMode('login');
    setLoginEmail('worldofagent@gmail.com');
    setLoginPassword('pharmacy123');
    setErrorMsg('');
  };

  const handleFillAdmin = () => {
    setMode('login');
    setLoginEmail('admin@medrefill.in');
    setLoginPassword('pharmacy123');
    setErrorMsg('');
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-2xl text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setErrorMsg('');
            setSuccessMsg('');
          }}
          className={`py-2.5 rounded-xl transition-all ${
            mode === 'login'
              ? 'bg-white text-teal-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setErrorMsg('');
            setSuccessMsg('');
          }}
          className={`py-2.5 rounded-xl transition-all ${
            mode === 'register'
              ? 'bg-white text-teal-800 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Create New Account
        </button>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900">
          {mode === 'login' ? 'Sign in to MedRefill' : 'Register New Pharmacy Staff'}
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {mode === 'login'
            ? 'Authorized pharmacy staff only. Customer data is encrypted.'
            : 'Create a new pharmacist or owner account to manage refills.'}
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-teal-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="shrink-0 text-teal-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* LOGIN FORM */}
      {mode === 'login' ? (
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
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
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
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
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
      ) : (
        /* REGISTER FORM */
        <form onSubmit={handleRegister} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                placeholder="e.g. Dr. Rajesh Kumar"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Work Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                placeholder="chemist@pharmacy.in"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Create Password (min 6 characters)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Role
            </label>
            <select
              value={regRole}
              onChange={(e) => setRegRole(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            >
              <option value="pharmacist">Registered Pharmacist</option>
              <option value="admin">Pharmacy Owner / Admin</option>
              <option value="delivery_manager">Delivery Coordinator</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer mt-1"
          >
            {loading ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <span>Complete Registration &amp; Sign In</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      )}

      {/* Quick Autofill Buttons for Saved Accounts */}
      <div className="pt-4 border-t border-gray-100 space-y-2">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
          <ShieldCheck size={13} className="text-teal-600" />
          Quick 1-Click Login:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleFillAgent}
            className="p-2.5 bg-teal-50/70 hover:bg-teal-100/80 border border-teal-200 rounded-xl text-left transition-colors"
          >
            <p className="text-xs font-bold text-teal-900 truncate">worldofagent@gmail.com</p>
            <p className="text-[10px] text-teal-700 font-mono">Password: pharmacy123</p>
          </button>

          <button
            type="button"
            onClick={handleFillAdmin}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left transition-colors"
          >
            <p className="text-xs font-bold text-slate-800 truncate">admin@medrefill.in</p>
            <p className="text-[10px] text-slate-600 font-mono">Password: pharmacy123</p>
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

        {/* Auth Form wrapped in Suspense for useSearchParams */}
        <Suspense fallback={
          <div className="bg-white rounded-3xl p-8 shadow-2xl text-center text-gray-400">
            Loading authentication portal...
          </div>
        }>
          <AuthForm />
        </Suspense>

        {/* Footer */}
        <p className="text-center text-xs text-teal-300/60">
          MedRefill • Chronic Refill &amp; Retail MARG ERP Integration
        </p>
      </div>
    </div>
  );
}
