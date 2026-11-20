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
  BarChart3,
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

const DASHBOARD_URL = '/api/reports/summary?days=7';

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<any>(() => getSwrCache(DASHBOARD_URL) ?? null);
  const [loading, setLoading] = useState(() => !getSwrCache(DASHBOARD_URL));
  const abortRef = useRef<AbortController | null>(null);

  const fetchSummary = useCallback(async (force = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const cached = getSwrCache<any>(DASHBOARD_URL);
    if (cached && !force) {
      setData(cached);
    }
    try {
      setLoading(true);
      const json = await fetchSwrJson<any>(DASHBOARD_URL, { force, signal: controller.signal });
      if (!controller.signal.aborted) setData(json);
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary(false);
    return () => abortRef.current?.abort();
  }, [fetchSummary]);

  return (
    <div className="space-y-6">
      {/* Header pantauan harian */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight text-balance">
              Dashboard Pantauan Stok
            </h1>
            <span className="text-xs bg-maroon-100 text-maroon-800 font-bold px-2 py-0.5 rounded-full border border-maroon-200">
              Live
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Selamat datang kembali, <strong className="text-slate-800">{currentUser?.name || 'Administrator'}</strong>. Pantau kondisi gudang harian, barang kritis, dan aktivitas terakhir.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
          <Link
            href="/reports"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 focus-visible:ring-offset-2"
            title="Buka evaluasi periode dan daftar usulan pengadaan"
          >
            <BarChart3 className="h-4 w-4 text-maroon-700" aria-hidden="true" />
            <span>Evaluasi & Pengadaan</span>
          </Link>
          <Link
            href="/telegram"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-maroon-200 bg-maroon-50 px-3 text-xs font-semibold text-maroon-800 transition-colors hover:border-maroon-300 hover:bg-maroon-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 focus-visible:ring-offset-2"
            title="Buka pengaturan Telegram"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>Telegram Bot</span>
          </Link>
          <button
            onClick={() => fetchSummary(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 focus-visible:ring-offset-2"
            aria-label="Muat ulang data dashboard"
            title="Muat ulang data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-maroon-700' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid (kondisi stok hari ini) */}
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
          title="Stok Menipis"
          value={data?.kpi?.lowStockCount ?? '...'}
          subtitle="Mencapai / di bawah minimum"
          icon={AlertTriangle}
          variant="warning"
          badge={data?.kpi?.lowStockCount > 0 ? 'Perhatian' : 'Aman'}
        />

        <KPICard
          title="Stok Habis"
          value={data?.kpi?.outOfStockCount ?? '...'}
          subtitle="Perlu segera diajukan pengadaan"
          icon={PackageX}
          variant="danger"
          badge={data?.kpi?.outOfStockCount > 0 ? 'Kritis' : 'Nol'}
        />
      </div>

      {/* Movement Chart Section (7 hari terakhir — pantauan mingguan cepat) */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Mutasi Barang 7 Hari Terakhir
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aktivitas masuk (IN) dan keluar (OUT) harian minggu ini
            </p>
          </div>

          <Link
            href="/reports"
            className="text-xs font-semibold text-maroon-800 hover:underline self-start sm:self-auto"
          >
            Lihat evaluasi 30 / 90 hari →
          </Link>
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
