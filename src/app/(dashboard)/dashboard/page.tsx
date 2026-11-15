'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Layers,
  AlertTriangle,
  PackageX,
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { StockChart } from '@/components/dashboard/StockChart';
import { CriticalTable } from '@/components/dashboard/CriticalTable';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { useAuth } from '@/components/layout/AuthContext';

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports/summary?days=${days}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [days]);

  return (
    <div className="space-y-6">
      {/* Top Welcome & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Dashboard Ringkasan Stok
            </h1>
            <span className="text-xs bg-maroon-100 text-maroon-800 font-bold px-2 py-0.5 rounded-full border border-maroon-200">
              Live
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Selamat datang kembali, <strong className="text-slate-800">{currentUser?.name || 'Administrator'}</strong>. Pantau pergerakan gudang dan persediaan secara akurat.
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <Link
            href="/stock/in"
            className="btn-3d-emerald inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Barang Masuk</span>
          </Link>

          <Link
            href="/stock/out"
            className="btn-3d inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-maroon-800 hover:bg-maroon-700 text-white text-xs font-bold transition-all"
          >
            <ArrowUpFromLine className="w-3.5 h-3.5" />
            <span>Barang Keluar</span>
          </Link>

          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 border border-white/90 text-xs font-bold shadow-soft hover:shadow-md transition-all badge-3d"
          >
            <Plus className="w-3.5 h-3.5 text-maroon-800" />
            <span>Tambah Barang</span>
          </Link>

          <button
            onClick={fetchSummary}
            className="p-2.5 rounded-xl bg-white/80 hover:bg-white text-slate-600 border border-white/90 shadow-soft hover:shadow-md transition-all badge-3d"
            title="Muat ulang data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-maroon-700' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total SKU Aktif"
          value={data?.kpi?.totalActiveSku ?? '...'}
          subtitle="Jenis barang aktif di master"
          icon={Package}
          variant="default"
        />

        <KPICard
          title="Total Unit Stok"
          value={data?.kpi?.totalAggregateStock ?? '...'}
          subtitle="Total fisik agregat persediaan"
          icon={Layers}
          variant="maroon"
        />

        <KPICard
          title="Stok Rendah"
          value={data?.kpi?.lowStockCount ?? '...'}
          subtitle="Mencapai / di bawah minimum"
          icon={AlertTriangle}
          variant="warning"
          badge={data?.kpi?.lowStockCount > 0 ? 'Perhatian' : 'Aman'}
        />

        <KPICard
          title="Stok Habis"
          value={data?.kpi?.outOfStockCount ?? '...'}
          subtitle="Segera lakukan restock / PO"
          icon={PackageX}
          variant="danger"
          badge={data?.kpi?.outOfStockCount > 0 ? 'Kritis' : 'Nol'}
        />
      </div>

      {/* Telegram Feature Highlight Banner - 3D Glass Maroon */}
      <div className="glass-maroon rounded-2xl p-5 text-white relative overflow-hidden group">
        <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform duration-700" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white flex-shrink-0 shadow-lg group-hover:rotate-6 transition-transform">
              <Send className="w-6 h-6 text-white drop-shadow-md" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <span>Integrasi Telegram Bot Real-time</span>
                <span className="text-[10px] bg-amber-400/90 text-amber-950 font-black px-2 py-0.5 rounded-full badge-3d">
                  Auto-Sync
                </span>
                <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              </h4>
              <p className="text-xs text-rose-100/90 mt-1 max-w-xl font-medium">
                Staff gudang & karyawan dapat melaporkan mutasi barang langsung lewat format chat Telegram tanpa perlu membuka laptop.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/telegram"
              className="px-4 py-2.5 rounded-xl bg-white text-maroon-900 hover:bg-maroon-50 text-xs font-black transition-all shadow-[0_4px_14px_rgba(0,0,0,0.15)] hover:shadow-lg active:translate-y-0.5"
            >
              Buka Simulator & Pengaturan
            </Link>
          </div>
        </div>
      </div>

      {/* Movement Chart Section */}
      <div className="glass-panel rounded-2xl p-6 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-200/60">
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
              Tren Mutasi Barang (Masuk vs Keluar)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Volume kuantitas barang masuk (IN) dan keluar (OUT) per hari
            </p>
          </div>

          <div className="flex items-center gap-1 bg-white/70 backdrop-blur-md p-1 rounded-xl border border-white/80 shadow-inner self-start sm:self-auto text-xs">
            <button
              onClick={() => setDays(7)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                days === 7 ? 'bg-maroon-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setDays(30)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                days === 30 ? 'bg-maroon-800 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Hari
            </button>
          </div>
        </div>

        <div className="pt-4">
          <StockChart data={data?.dailyTrends || []} />
        </div>
      </div>

      {/* Two Column Grid: Critical Stock + Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CriticalTable items={data?.criticalItems || []} />
        <RecentActivity movements={data?.recentActivities || []} />
      </div>
    </div>
  );
}
