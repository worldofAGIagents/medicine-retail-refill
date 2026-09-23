'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Pill, ClipboardList, RefreshCw,
  Package, Upload, Settings, Bell, Search, LogOut, Printer,
  Menu, X, QrCode, Receipt
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Retail Billing', href: '/billing', icon: Receipt },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Medicines', href: '/medicines', icon: Pill },
  { name: 'Prescriptions', href: '/prescriptions', icon: ClipboardList },
  { name: 'Refills', href: '/refills', icon: RefreshCw },
  { name: 'Daily Delivery PDF', href: '/delivery-sheet', icon: Printer },
  { name: 'Instant UPI QR', href: '/quick-qr', icon: QrCode },
  { name: 'Orders & Sales', href: '/orders', icon: Package },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({
  open,
  onClose,
  userName = 'Pharmacist',
  userRole = 'Pharmacist',
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}) {
  const pathname = usePathname();

  const handleLogout = onLogout || (async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/login';
  });

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Backdrop overlay on mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-gradient-to-b from-teal-800 to-teal-900 text-white flex flex-col z-50 transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Logo + Close button on mobile */}
        <div className="px-5 py-4 border-b border-teal-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-500 rounded-xl flex items-center justify-center">
              <Pill className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold font-heading tracking-tight leading-tight">Manoj Medical Hall</h1>
              <p className="text-[10px] text-teal-300">Sarfuddinpur • Muzaffarpur (843118)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/15 text-white shadow-sm font-semibold backdrop-blur-sm'
                    : 'text-teal-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                {isActive && (
                  <span className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-teal-300 shadow-xs" />
                )}
                <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-teal-300' : ''}`} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="px-4 py-4 border-t border-teal-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center text-sm font-bold shrink-0 uppercase shadow-xs">
              {userName.split(' ').map(n => n[0]).join('').slice(0, 2) || 'RX'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{userName}</p>
              <p className="text-[11px] text-teal-300 truncate capitalize">{userRole}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-teal-300 hover:text-white transition-colors shrink-0 p-1.5 rounded-lg hover:bg-white/10"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function TopBar({ onMenuClick, userName }: { onMenuClick: () => void; userName?: string }) {
  const displayName = userName || 'Pharmacist';
  const initials = displayName.split(' ').map(n => n[0]).join('').slice(0, 2) || 'RX';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/login';
  };

  return (
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-14 lg:h-16 bg-white/95 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 lg:px-6 z-30 shadow-2xs">
      <div className="flex items-center gap-3">
        {/* Hamburger on mobile */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <Menu className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h2 className="text-sm lg:text-base font-bold text-gray-900 font-heading leading-tight">
            <span className="hidden sm:inline">Welcome back, {displayName.split(' ')[0]} 👋</span>
            <span className="sm:hidden font-bold">Manoj Medical Hall</span>
          </h2>
          <p className="hidden sm:block text-[11px] text-gray-500 font-medium">
            Manoj Medical Hall • Sarfuddinpur (843118)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-3.5">
        {/* WhatsApp & Auto-Refill Live Status Pill */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200/80 rounded-full text-emerald-800 text-[11px] font-bold shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>WhatsApp Engine Live</span>
        </div>

        {/* Search with keyboard shortcut badge */}
        <div className="relative hidden md:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search medicines, patients..."
            className="pl-9 pr-12 py-1.5 w-48 lg:w-60 text-xs bg-gray-50/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium text-gray-800 placeholder-gray-400 shadow-2xs"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-gray-400 bg-white border border-gray-200 rounded shadow-2xs">
            ⌘K
          </kbd>
        </div>

        {/* Instant QR Quick Trigger */}
        <Link
          href="/quick-qr"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:shadow-sm"
          title="Instant Dynamic UPI QR Generator"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">⚡ Instant QR</span>
          <span className="sm:hidden">QR</span>
        </Link>

        {/* Profile & Logout dropdown / button */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-bold uppercase shadow-2xs">
            {initials}
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('Pharmacist');
  const [userRole, setUserRole] = useState('Pharmacist');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) {
          if (data.user.name) setUserName(data.user.name);
          if (data.user.role) setUserRole(data.user.role);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userName={userName}
        userRole={userRole}
        onLogout={handleLogout}
      />
      <TopBar onMenuClick={() => setSidebarOpen(true)} userName={userName} />
      <main className="lg:ml-64 pt-14 lg:pt-16 p-3 sm:p-4 lg:p-6">
        {children}
      </main>
    </div>
  );
}
