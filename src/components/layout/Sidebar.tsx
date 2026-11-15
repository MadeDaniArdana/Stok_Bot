'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Tags,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  FileCheck2,
  BarChart3,
  Users,
  Send,
  Settings,
  Boxes,
  X,
  ChevronRight,
  ShieldCheck,
  UserCheck,
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
        { name: 'Barang Keluar', href: '/stock/out', icon: ArrowUpFromLine, badge: 'OUT' },
        { name: 'Riwayat Transaksi', href: '/stock/history', icon: History },
        { name: 'Permintaan Stok', href: '/requests', icon: FileCheck2 },
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
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white/75 backdrop-blur-xl border-r border-white/70 shadow-[4px_0_30px_rgba(128,0,32,0.04)] flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/60 bg-gradient-to-r from-white/90 via-white/70 to-maroon-50/30">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-maroon-700 via-maroon-800 to-maroon-950 flex items-center justify-center text-white shadow-maroon shadow-md ring-1 ring-white/40 group-hover:scale-105 transition-all duration-300">
              <Boxes className="w-5 h-5 text-white drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">Stock</span>
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-maroon-800 to-maroon-950 bg-clip-text text-transparent">Flow</span>
              </div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Inventory 3D System</p>
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
                        ? 'bg-gradient-to-r from-maroon-100/80 via-maroon-50/70 to-white/40 text-maroon-950 font-bold border-l-4 border-maroon-800 shadow-[0_4px_14px_rgba(128,0,32,0.08)] backdrop-blur-sm'
                        : 'text-slate-600 hover:text-maroon-900 hover:bg-white/70 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1 rounded-lg transition-all ${
                        isActive
                          ? 'bg-maroon-800 text-white shadow-sm'
                          : 'text-slate-400 group-hover:text-maroon-800 group-hover:bg-maroon-50'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span>{item.name}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold badge-3d ${
                          item.badge === 'IN'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm'
                            : 'bg-maroon-50 text-maroon-800 border border-maroon-200 shadow-sm'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}

                    {item.highlight && (
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-maroon-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-maroon-700 shadow-sm"></span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Card at bottom of sidebar */}
        <div className="p-3 border-t border-white/60 bg-white/40 backdrop-blur-md">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/90 shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:shadow-md transition-all">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-sm ring-1 ring-white/50 ${
                isAdmin
                  ? 'bg-gradient-to-br from-maroon-700 to-maroon-950 shadow-maroon'
                  : 'bg-gradient-to-br from-slate-600 to-slate-800'
              }`}
            >
              {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : 'SF'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">
                {currentUser?.name || 'Memuat...'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isAdmin ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-maroon-800 bg-maroon-100/70 px-2 py-0.2 rounded-full border border-maroon-200/60 badge-3d">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.2 rounded-full border border-slate-200 badge-3d">
                    <UserCheck className="w-2.5 h-2.5" />
                    Staff
                  </span>
                )}
                {currentUser?.telegram && (
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-100/70 border border-sky-200/60 px-1.5 py-0.2 rounded-full badge-3d">TG</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
