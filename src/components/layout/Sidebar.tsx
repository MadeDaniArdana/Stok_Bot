'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Tags,
  ArrowDownToLine,
  History,
  BarChart3,
  Users,
  Send,
  Settings,
  Boxes,
  X,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Camera,
} from 'lucide-react';
import { useAuth } from './AuthContext';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string;
  highlight?: boolean;
  adminOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const navItems: NavSection[] = [
    {
      title: 'Menu Utama',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Master Barang', href: '/products', icon: Package },
        { name: 'Kategori', href: '/categories', icon: Tags },
      ],
    },
    {
      title: 'Inventori & Mutasi',
      items: [
        { name: 'Barang Masuk', href: '/stock/in', icon: ArrowDownToLine, badge: 'IN' },
        { name: 'Riwayat Stok', href: '/stock/history', icon: History },
        { name: 'Laporan Pemasangan', href: '/tasks', icon: Camera },
      ],
    },
    {
      title: 'Analitik & Sistem',
      items: [
        { name: 'Laporan', href: '/reports', icon: BarChart3 },
        { name: 'Pengguna', href: '/users', icon: Users, adminOnly: true },
        { name: 'Integrasi Telegram', href: '/telegram', icon: Send, highlight: true },
        { name: 'Pengaturan', href: '/settings', icon: Settings },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 bg-gradient-to-r from-white via-white to-maroon-50/40">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-maroon-700 via-maroon-800 to-maroon-950 flex items-center justify-center text-white shadow-maroon shadow-sm group-hover:scale-105 transition-transform">
              <Boxes className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-slate-900">Stock</span>
                <span className="font-bold text-lg tracking-tight text-maroon-800">Flow</span>
              </div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Inventory System</p>
            </div>
          </Link>

          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navItems.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {section.title}
              </p>
              {section.items.map((item) => {
                if (item.adminOnly && !isAdmin) return null;
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                      isActive
                        ? 'bg-maroon-50 text-maroon-900 font-semibold border-l-4 border-maroon-800 shadow-sm'
                        : 'text-slate-600 hover:text-maroon-900 hover:bg-maroon-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive ? 'text-maroon-800' : 'text-slate-400 group-hover:text-maroon-700'
                        }`}
                      />
                      <span>{item.name}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          item.badge === 'IN'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-maroon-100 text-maroon-800 border border-maroon-200'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {item.highlight && (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-maroon-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-maroon-700"></span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Card at bottom of sidebar */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-200/80 shadow-soft">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-xs ${
                isAdmin
                  ? 'bg-gradient-to-br from-maroon-800 to-maroon-950'
                  : 'bg-gradient-to-br from-slate-600 to-slate-800'
              }`}
            >
              {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : 'SF'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {currentUser?.name || 'Memuat...'}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                {isAdmin ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-maroon-800 bg-maroon-50 px-1.5 py-0.2 rounded border border-maroon-200">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                    <UserCheck className="w-2.5 h-2.5" />
                    Staff
                  </span>
                )}
                {currentUser?.telegram && (
                  <span className="text-[10px] text-sky-600 bg-sky-50 px-1 py-0.2 rounded">TG</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
