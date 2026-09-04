'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Pill, ClipboardList, RefreshCw,
  Package, Upload, Settings, Bell, Search, LogOut, Printer
} from 'lucide-react';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Medicines', href: '/medicines', icon: Pill },
  { name: 'Prescriptions', href: '/prescriptions', icon: ClipboardList },
  { name: 'Refills', href: '/refills', icon: RefreshCw },
  { name: 'Daily Delivery PDF', href: '/delivery-sheet', icon: Printer },
  { name: 'Orders', href: '/orders', icon: Package },
  { name: 'Import Data', href: '/import', icon: Upload },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-gradient-to-b from-teal-800 to-teal-900 text-white flex flex-col z-50">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-teal-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-500 rounded-xl flex items-center justify-center">
            <Pill className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-heading tracking-tight">MedRefill</h1>
            <p className="text-[10px] text-teal-300 -mt-0.5">Auto-Refill Dashboard</p>
          </div>
        </div>
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white/15 text-white shadow-sm backdrop-blur-sm'
                  : 'text-teal-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-teal-300' : ''}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="px-4 py-4 border-t border-teal-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center text-sm font-bold">
            RK
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Rajesh Kumar</p>
            <p className="text-xs text-teal-300 truncate">Pharmacist</p>
          </div>
          <button className="text-teal-300 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function TopBar() {
  return (
    <header className="fixed top-0 left-60 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 z-40">
      <div>
        <h2 className="text-lg font-semibold text-gray-800 font-heading">
          Welcome back, Rajesh 👋
        </h2>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search medicines, customers..."
            className="pl-10 pr-4 py-2 w-72 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-xl hover:bg-gray-50 transition-colors">
          <Bell className="w-5 h-5 text-gray-500" />
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            5
          </span>
        </button>

        {/* Profile */}
        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold">
            RK
          </div>
        </div>
      </div>
    </header>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <Sidebar />
      <TopBar />
      <main className="ml-60 pt-16 p-6">
        {children}
      </main>
    </div>
  );
}
