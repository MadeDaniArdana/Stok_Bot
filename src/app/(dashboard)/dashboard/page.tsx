'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Package,
  Layers,
  AlertTriangle,
  PackageX,
  RefreshCw,
  Send,
} from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { CriticalTable } from '@/components/dashboard/CriticalTable';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { useAuth } from '@/components/layout/AuthContext';
import { fetchSwrJson, getSwrCache } from '@/lib/client-swr';

// Grafik Recharts dimuat terpisah agar KPI cards & tabel kritis tampil dan interaktif lebih cepat.
const StockChart = dynamic(
  () => import('@/components/dashboard/StockChart').then((mod) => mod.StockChart),
  { ssr: false, loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-slate-100" /> }
);

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [days, setDays] = useState(30);
  const initialKey = `/api/reports/summary?days=${days}`;
  const [data, setData] = useState<any>(() => getSwrCache(initialKey) ?? null);
  const [loading, setLoading] = useState(() => !getSwrCache(initialKey));
  const abortRef = useRef<AbortController | null>(null);

  const fetchSummary = useCallback(async (periodDays = days, force = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const url = `/api/reports/summary?days=${periodDays}`;
    const cached = getSwrCache<any>(url);
    if (cached && !force) {
      setData(cached);
    }
    try {
      setLoading(true);
      const json = await fetchSwrJson<any>(url, { force, signal: controller.signal });
      if (!controller.signal.aborted) setData(json);
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchSummary(days);
    return () => abortRef.current?.abort();
  }, [days, fetchSummary]);

  return (
    <div className="space-y-6">
      {/* Ringkasan dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight text-balance">
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

        <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
          <Link
            href="/telegram"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-maroon-200 bg-maroon-50 px-3 text-xs font-semibold text-maroon-800 transition-colors hover:border-maroon-300 hover:bg-maroon-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 focus-visible:ring-offset-2"
            title="Buka pengaturan Telegram"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>Telegram Bot</span>
          </Link>
          <button
            onClick={() => fetchSummary(days, true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 focus-visible:ring-offset-2"
            aria-label="Muat ulang data dashboard"
            title="Muat ulang data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-maroon-700' : ''}`} aria-hidden="true" />
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
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <CriticalTable items={(data?.criticalItems || []).slice(0, 5)} />
        <RecentActivity movements={(data?.recentActivities || []).slice(0, 5)} />
      </div>
    </div>
  );
}
