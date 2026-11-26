'use client';

import React, { memo, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  History,
  BarChart3,
  Settings,
  X,
  ChevronDown,
  ShieldCheck,
  UserCheck,
  Truck,
  ClipboardList,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { prefetchDistributionBootstrap } from '@/lib/distribution-bootstrap';
import { prefetchSwrJson } from '@/lib/client-swr';
import { getCurrentReportMonth } from '@/lib/report-period';
import { parseStockGroup } from '@/lib/stock-groups';

interface SidebarProps {
  /** divisi = menu akun divisi (Dashboard, Pengajuan, Riwayat). */
  variant?: 'admin' | 'divisi';
  mobileOpen: boolean;
  onCloseMobile: () => void;
  /** Desktop: hanya ikon. Di HP laci menu selalu tampil penuh. */
  collapsed?: boolean;
  onExpand?: () => void;
  onToggleCollapse?: () => void;
}

interface NavChild {
  name: string;
  href: string;
  adminOnly?: boolean;
}

interface NavItem {
  name: string;
  /** Untuk menu induk (punya children), href hanya dipakai sebagai kunci. */
  href: string;
  children?: NavChild[];
  icon: any;
  badge?: string;
  adminOnly?: boolean;
  /** Aktif hanya pada path persis (untuk halaman induk seperti /divisi). */
  exact?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Dikelompokkan menurut kegiatan: data barang, transaksi harian, laporan, lalu urusan sistem.
// Asisten AI dipindah ke tombol di header.
const NAV_ITEMS: NavSection[] = [
  {
    title: 'Menu Utama',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      {
        name: 'Barang',
        href: '/products',
        icon: Package,
        children: [
          { name: 'Master Barang ATK', href: '/products/atk' },
          { name: 'Master Barang Peralatan Listrik', href: '/products/listrik' },
          { name: 'Master Barang Logistik', href: '/products/logistik' },
          { name: 'Kategori', href: '/categories' },
        ],
      },
    ],
  },
  {
    title: 'Transaksi',
    items: [
      {
        name: 'Distribusi Barang',
        href: '/distribution',
        icon: Truck,
        children: [
          { name: 'Distribusi ATK', href: '/distribution/atk' },
          { name: 'Distribusi Peralatan Listrik', href: '/distribution/listrik' },
          { name: 'Distribusi Logistik', href: '/distribution/logistik' },
        ],
      },
      {
        name: 'Pengajuan',
        href: '/requests',
        icon: ClipboardList,
        children: [
          { name: 'Pengajuan Masuk', href: '/requests/incoming' },
          { name: 'Riwayat Pengajuan', href: '/requests/history' },
        ],
      },
      { name: 'Riwayat Stok', href: '/stock/history', icon: History },
    ],
  },
  {
    title: 'Laporan & Sistem',
    items: [
      {
        name: 'Laporan',
        href: '#laporan',
        icon: BarChart3,
        children: [
          { name: 'Laporan Distribusi ATK', href: '/distribution-reports/atk' },
          { name: 'Laporan Distribusi Listrik', href: '/distribution-reports/listrik' },
          { name: 'Laporan Distribusi Logistik', href: '/distribution-reports/logistik' },
          { name: 'Laporan Pemasangan', href: '/tasks' },
          { name: 'Ringkasan Persediaan', href: '/reports' },
        ],
      },
      {
        name: 'Sistem',
        href: '#sistem',
        icon: Settings,
        children: [
          { name: 'Pengguna', href: '/users', adminOnly: true },
          { name: 'Integrasi Telegram', href: '/telegram' },
          { name: 'Log Error', href: '/logs' },
          { name: 'Pengaturan', href: '/settings' },
        ],
      },
    ],
  },
];

const DIVISI_NAV: NavSection[] = [
  {
    title: 'Menu Utama',
    items: [
      { name: 'Dashboard', href: '/divisi', icon: LayoutDashboard, exact: true },
      { name: 'Pengajuan', href: '/divisi/pengajuan', icon: ClipboardList },
      { name: 'Riwayat', href: '/divisi/riwayat', icon: History },
    ],
  },
];

export const Sidebar = memo(function Sidebar({ variant = 'admin', mobileOpen, onCloseMobile, collapsed = false, onExpand, onToggleCollapse }: SidebarProps) {
  // Kelas yang hanya berlaku di desktop saat sidebar diringkas (laci HP tetap penuh).
  // Gaya ringkas lewat CSS (variant mini:), bukan state, agar tidak berkedip saat halaman pertama dimuat.
  const hideMini = 'lg:mini:hidden';
  const centerMini = 'lg:mini:justify-center lg:mini:px-0';
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';
  const isDivisi = variant === 'divisi';
  const navSections = isDivisi ? DIVISI_NAV : NAV_ITEMS;
  const homeHref = isDivisi ? '/divisi' : '/dashboard';

  // Cocok persis atau sub-halaman (/stock/history/...), bukan sekadar awalan teks:
  // /distribution tidak boleh ikut aktif saat membuka /distribution-reports.
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Menu induk terbuka otomatis bila salah satu sub menunya sedang dibuka.
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());
  useEffect(() => {
    const activeParent = navSections
      .flatMap((section) => section.items)
      .find((item) => item.children?.some((child) => matches(child.href)));
    if (activeParent) setOpenMenus((current) => (current.has(activeParent.href) ? current : new Set(current).add(activeParent.href)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleMenu = (href: string) =>
    setOpenMenus((current) => {
      const next = new Set(current);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });

  const warmHref = (href: string) => {
    if (href === '/dashboard') {
      prefetchSwrJson('/api/reports/summary?days=7&view=dashboard');
      return;
    }
    if (href === '/reports') {
      prefetchSwrJson(`/api/reports/summary?periode=${getCurrentReportMonth()}&includePosition=1`);
      return;
    }
    if (href.startsWith('/distribution/')) {
      const group = parseStockGroup(href.slice('/distribution/'.length));
      if (group) prefetchDistributionBootstrap(group);
      return;
    }
    if (href.startsWith('/products/')) {
      const group = parseStockGroup(href.slice('/products/'.length));
      if (group) {
        prefetchSwrJson('/api/categories', 60_000);
        prefetchSwrJson(
          `/api/products?${new URLSearchParams({ search: '', categoryId: 'all', stockStatus: 'all', status: 'all', limit: '500', jenis: group, stockMonth: getCurrentReportMonth() })}`
        );
      }
      return;
    }
    if (href.startsWith('/distribution-reports/')) {
      const group = parseStockGroup(href.slice('/distribution-reports/'.length));
      if (group) {
        prefetchSwrJson(
          `/api/distributions?${new URLSearchParams({ jenis: group, month: getCurrentReportMonth(), status: 'all', page: '1' })}`
        );
      }
    }
  };

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
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-[transform,width] duration-300 ease-in-out lg:translate-x-0 lg:mini:w-[4.5rem] ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand Header */}
        <div className={`h-16 flex items-center justify-between px-5 border-b border-slate-100 bg-gradient-to-r from-white via-white to-maroon-50/40 ${centerMini}`}>
          <Link href={homeHref} className="flex items-center gap-3 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-yayasan.png" alt="Logo Yayasan Pendidikan Teknokrat" width={40} height={40} className="h-10 w-10 object-contain group-hover:scale-105 transition-transform" />
            <div className={hideMini}>
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
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-6 lg:mini:space-y-3">
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <p className={`px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 ${hideMini}`}>
                {section.title}
              </p>
              {idx > 0 && <div className="hidden lg:mini:block mx-2 mb-2 border-t border-slate-200" />}
              {section.items.map((item) => {
                if (item.adminOnly && !isAdmin) return null;
                const Icon = item.icon;

                if (item.children) {
                  const children = item.children.filter((child) => !child.adminOnly || isAdmin);
                  const childActive = children.some((child) => matches(child.href));
                  const open = openMenus.has(item.href);
                  const menuId = `submenu-${item.href.replace(/\W+/g, '-')}`;
                  return (
                    <div key={item.href}>
                      <button
                        type="button"
                        onClick={() => {
                          // Mode ringkas: klik ikon membuka sidebar lalu sub menunya.
                          if (collapsed && window.matchMedia('(min-width: 1024px)').matches) {
                            onExpand?.();
                            setOpenMenus((current) => new Set(current).add(item.href));
                            return;
                          }
                          toggleMenu(item.href);
                        }}
                        aria-expanded={open}
                        aria-controls={menuId}
                        title={collapsed ? item.name : undefined}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm leading-6 font-medium transition-all group ${centerMini} ${
                          childActive
                            ? 'text-maroon-900 font-semibold lg:mini:bg-maroon-50'
                            : 'text-slate-600 hover:text-maroon-900 hover:bg-maroon-50/50'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 shrink-0 transition-colors ${childActive ? 'text-maroon-800' : 'text-slate-400 group-hover:text-maroon-700'}`} />
                          <span className={`whitespace-nowrap ${hideMini}`}>{item.name}</span>
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''} ${hideMini}`} />
                      </button>
                      {open && (
                        <div id={menuId} className={`ml-5 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3 ${hideMini}`}>
                          {children.map((child) => {
                            const active = matches(child.href);
                            const warm = () => warmHref(child.href);
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={onCloseMobile}
                                onMouseEnter={warm}
                                onFocus={warm}
                                aria-current={active ? 'page' : undefined}
                                className={`block rounded-lg px-3 py-2 text-[13px] leading-5 transition-colors ${
                                  active
                                    ? 'bg-maroon-50 text-maroon-900 font-semibold shadow-sm'
                                    : 'text-slate-600 hover:text-maroon-900 hover:bg-maroon-50/50'
                                }`}
                              >
                                {child.name}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                const isActive = item.exact ? pathname === item.href : matches(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    onMouseEnter={() => warmHref(item.href)}
                    onFocus={() => warmHref(item.href)}
                    title={collapsed ? item.name : undefined}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm leading-6 font-medium transition-all group ${centerMini} ${
                      isActive
                        ? 'bg-maroon-50 text-maroon-900 font-semibold shadow-sm'
                        : 'text-slate-600 hover:text-maroon-900 hover:bg-maroon-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-maroon-800' : 'text-slate-400 group-hover:text-maroon-700'
                        }`}
                      />
                      <span className={`whitespace-nowrap ${hideMini}`}>{item.name}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${hideMini} ${
                          item.badge === 'IN'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-maroon-100 text-maroon-800 border border-maroon-200'
                        }`}
                      >
                        {item.badge}
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
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`hidden lg:flex w-full items-center gap-2 mb-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-maroon-900 hover:bg-white ${centerMini}`}
              title={collapsed ? 'Tampilkan menu' : 'Sembunyikan menu'}
              aria-label={collapsed ? 'Tampilkan menu samping' : 'Ringkas menu samping'}
            >
              <ChevronsLeft className="w-4 h-4 mini:hidden" />
              <ChevronsRight className="w-4 h-4 hidden mini:block" />
              <span className={hideMini}>Sembunyikan menu</span>
            </button>
          )}
          <div
            className="flex items-center gap-3 p-2 rounded-xl bg-white border border-slate-200/80 shadow-soft lg:mini:justify-center lg:mini:border-0 lg:mini:bg-transparent lg:mini:shadow-none lg:mini:p-0"
            title={collapsed ? currentUser?.name : undefined}
          >
            <div
              className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center font-bold text-white text-xs ${
                isAdmin
                  ? 'bg-gradient-to-br from-maroon-800 to-maroon-950'
                  : 'bg-gradient-to-br from-slate-600 to-slate-800'
              }`}
            >
              {currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : 'SF'}
            </div>
            <div className={`flex-1 min-w-0 ${hideMini}`}>
              <p className="text-sm font-medium text-slate-800 truncate">
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
                    {isDivisi ? 'Divisi' : 'Staff'}
                  </span>
                )}
                {!isDivisi && currentUser?.telegram && (
                  <span className="text-[10px] text-sky-600 bg-sky-50 px-1 py-0.2 rounded">TG</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
});
