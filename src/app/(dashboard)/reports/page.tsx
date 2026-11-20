'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
} from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { fetchSwrJson, getSwrCache } from '@/lib/client-swr';

// Grafik Recharts dimuat terpisah agar ringkasan angka & tabel tampil lebih cepat.
const StockChart = dynamic(
  () => import('@/components/dashboard/StockChart').then((mod) => mod.StockChart),
  { ssr: false, loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-slate-100" /> }
);

export default function ReportsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(() => getSwrCache(`/api/reports/summary?days=30`) ?? null);

  useEffect(() => {
    const controller = new AbortController();
    const url = `/api/reports/summary?days=${days}`;
    const cached = getSwrCache<any>(url);
    if (cached) setData(cached);

    fetchSwrJson<any>(url, { signal: controller.signal })
      .then((json) => {
        if (!controller.signal.aborted) setData(json);
      })
      .catch((e: any) => {
        if (e?.name !== 'AbortError') console.error(e);
      });
    return () => controller.abort();
  }, [days]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight text-balance">
            Ringkasan Persediaan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Ringkasan pemakaian barang, tren perputaran stok, dan evaluasi pengadaan
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm text-xs">
          <button
            onClick={() => setDays(7)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              days === 7 ? 'bg-maroon-800 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7 Hari Terakhir
          </button>
          <button
            onClick={() => setDays(30)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              days === 30 ? 'bg-maroon-800 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            30 Hari Terakhir
          </button>
          <button
            onClick={() => setDays(90)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              days === 90 ? 'bg-maroon-800 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Triwulan (90 Hari)
          </button>
        </div>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Barang Masuk"
          value={data?.kpi?.totalInQuantity ?? '...'}
          subtitle={`Periode ${days} hari terakhir`}
          icon={ArrowDownToLine}
          variant="success"
        />

        <KPICard
          title="Total Barang Keluar"
          value={data?.kpi?.totalOutQuantity ?? '...'}
          subtitle="Pemakaian divisi & operasional"
          icon={ArrowUpFromLine}
          variant="maroon"
        />

        <KPICard
          title="Net Pergerakan"
          value={data?.kpi?.netMovement !== undefined ? (data.kpi.netMovement > 0 ? `+${data.kpi.netMovement}` : data.kpi.netMovement) : '...'}
          subtitle="Selisih Masuk vs Keluar"
          icon={TrendingUp}
          variant="default"
        />

        <KPICard
          title="Barang Butuh Pengadaan"
          value={data?.criticalItems?.length ?? '...'}
          subtitle="Barang kritis & habis"
          icon={AlertTriangle}
          variant="danger"
          badge={data?.criticalItems?.length > 0 ? 'Perlu Restock' : 'Aman'}
        />
      </div>

      {/* Chart Section */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft">
        <div className="pb-4 border-b border-slate-100">
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            Dinamika Arus Persediaan Harian
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Perbandingan volume penerimaan barang (IN) vs konsumsi pemakaian (OUT)
          </p>
        </div>
        <div className="pt-4">
          <StockChart data={data?.dailyTrends || []} />
        </div>
      </div>

      {/* Two Column: Top Consumed vs Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Most Consumed Items */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-soft p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            Top 5 Barang Paling Sering Digunakan
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Daftar persediaan dengan konsumsi volume tertinggi pada periode ini
          </p>

          <div className="divide-y divide-slate-100 text-xs">
            {!data?.topConsumed || data.topConsumed.length === 0 ? (
              <p className="text-center py-6 text-slate-400">Belum ada pemakaian barang pada periode ini.</p>
            ) : (
              data.topConsumed.map((item: any, idx: number) => (
                <div key={idx} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-maroon-50 text-maroon-800 font-bold text-xs flex items-center justify-center border border-maroon-200">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{item.product.name}</p>
                      <span className="font-mono text-[11px] text-slate-400">
                        {item.product.sku} • {item.txCount} kali pengambilan
                      </span>
                    </div>
                  </div>

                  <span className="font-bold text-sm text-maroon-800">
                    {item.totalOut} {item.product.unit}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-soft p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            Sebaran Stok per Kategori
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Distribusi jumlah jenis barang dan total unit persediaan
          </p>

          <div className="divide-y divide-slate-100 text-xs">
            {!data?.categoryStats || data.categoryStats.length === 0 ? (
              <p className="text-center py-6 text-slate-400">Belum ada data kategori.</p>
            ) : (
              data.categoryStats.map((cat: any, idx: number) => (
                <div key={idx} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{cat.name}</p>
                    <span className="text-[11px] text-slate-400">
                      {cat.itemCount} macam barang aktif
                    </span>
                  </div>

                  <span className="font-mono font-bold text-slate-800 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                    {cat.totalStock} unit
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
