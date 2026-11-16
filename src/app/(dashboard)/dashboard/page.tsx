'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Layers,
  AlertTriangle,
  PackageX,
  ArrowDownToLine,
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
        <div className="flex items-center flex-wrap gap-2">
          <Link
            href="/stock/in"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all hover:shadow"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Barang Masuk</span>
          </Link>

          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-maroon-800" />
            <span>Tambah Barang</span>
          </Link>

          <button
            onClick={fetchSummary}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 shadow-sm transition-colors"
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

      {/* Telegram Feature Highlight Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-maroon-900 via-maroon-800 to-maroon-950 text-white shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-maroon-200 flex-shrink-0">
            <Send className="w-5 h-5 text-maroon-200" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Integrasi Telegram Bot Siap Pakai</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </h4>
            <p className="text-xs text-maroon-200 mt-0.5">
              Admin membuat tugas pemasangan di Telegram; pemasang mengirim foto bukti melalui link WhatsApp.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/telegram"
            className="px-3.5 py-1.5 rounded-lg bg-white text-maroon-900 hover:bg-maroon-50 text-xs font-bold transition-all shadow-sm"
          >
            Buka Pengaturan Telegram
          </Link>
        </div>
      </div>

      {/* Movement Chart Section */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Tren Mutasi Barang (Masuk vs Keluar)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Volume kuantitas barang masuk (IN) dan keluar (OUT) per hari
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto text-xs">
            <button
              onClick={() => setDays(7)}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                days === 7 ? 'bg-white text-maroon-900 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setDays(30)}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                days === 30 ? 'bg-white text-maroon-900 font-bold shadow-sm' : 'text-slate-600 hover:text-slate-900'
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
