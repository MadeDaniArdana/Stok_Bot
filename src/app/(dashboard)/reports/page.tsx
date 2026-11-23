'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  TrendingUp,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Printer,
  Download,
  Building2,
  ClipboardList,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { StockPositionSection } from '@/components/dashboard/StockPositionSection';
import { fetchSwrJson, getSwrCache } from '@/lib/client-swr';
import { STOCK_GROUPS, type StockGroup } from '@/lib/stock-groups';
import { getCurrentReportMonth } from '@/lib/report-period';

// Grafik Recharts dimuat terpisah agar ringkasan angka & tabel tampil lebih cepat.
const StockChart = dynamic(
  () => import('@/components/dashboard/StockChart').then((mod) => mod.StockChart),
  { ssr: false, loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-slate-100" /> }
);

type GroupFilter = 'ALL' | StockGroup;

const GROUP_OPTIONS: Array<{ value: GroupFilter; label: string }> = [
  { value: 'ALL', label: 'Semua Jenis' },
  ...STOCK_GROUPS.map((g) => ({ value: g.id as GroupFilter, label: g.shortLabel })),
];

type PeriodMode = 'month' | 'year';

function buildQuery(periode: string, groupFilter: GroupFilter) {
  const params = new URLSearchParams({ periode });
  if (groupFilter !== 'ALL') params.set('jenis', groupFilter);
  return params.toString();
}

function buildSummaryUrl(periode: string, groupFilter: GroupFilter) {
  const params = new URLSearchParams({ periode });
  if (groupFilter !== 'ALL') params.set('jenis', groupFilter);
  return `/api/reports/summary?${params.toString()}`;
}

export default function ReportsPage() {
  const currentMonth = getCurrentReportMonth();
  const currentYear = Number(currentMonth.slice(0, 4));
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(String(currentYear));
  const periode = periodMode === 'year' ? year : month;
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('ALL');
  const initialUrl = buildSummaryUrl(currentMonth, 'ALL');
  const [data, setData] = useState<any>(() => getSwrCache(initialUrl) ?? null);
  const [loading, setLoading] = useState(() => !getSwrCache(initialUrl));

  useEffect(() => {
    const controller = new AbortController();
    const url = buildSummaryUrl(periode, groupFilter);
    const cached = getSwrCache<any>(url);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    fetchSwrJson<any>(url, { signal: controller.signal })
      .then((json) => {
        if (!controller.signal.aborted) setData(json);
      })
      .catch((e: any) => {
        if (e?.name !== 'AbortError') console.error(e);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [periode, groupFilter]);

  const queryStr = buildQuery(periode, groupFilter);
  const periodLabel: string = data?.period?.label ?? (periodMode === 'year' ? `Tahun ${year}` : '');
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const criticalItems: any[] = data?.criticalItems || [];
  const topConsumed: any[] = data?.topConsumed || [];
  const topUnits: any[] = data?.topUnits || [];
  const categoryStats: any[] = data?.categoryStats || [];
  const stockGroupStats: any[] = data?.stockGroupStats || [];
  const isWeekly = data?.trendGranularity === 'weekly';

  return (
    <div className="space-y-6">
      {/* Header + Aksi Cetak / Unduh */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight text-balance">
            Ringkasan Persediaan & Pengadaan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Evaluasi arus barang, daftar usulan pengadaan, dan pola pemakaian unit Bagian Umum & Rumah Tangga
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/print/inventory-summary?${queryStr}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-soft hover:bg-slate-50"
          >
            <Printer className="h-4 w-4 text-maroon-700" />
            Cetak Laporan A4
          </a>
          <a
            href={`/api/reports/export?${queryStr}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-maroon-200 bg-maroon-50 px-3.5 py-2 text-xs font-semibold text-maroon-800 shadow-soft hover:bg-maroon-100"
          >
            <Download className="h-4 w-4" />
            Unduh CSV Pengadaan
          </a>
        </div>
      </div>

      {/* Filter Jenis Stok & Periode */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold text-slate-500">Jenis Stok:</span>
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setGroupFilter(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                groupFilter === opt.value
                  ? 'bg-maroon-800 font-semibold text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs">
            {(['month', 'year'] as PeriodMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setPeriodMode(m)}
                className={`rounded-md px-3 py-1 font-medium transition-all ${
                  periodMode === m ? 'bg-white font-bold text-maroon-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m === 'month' ? 'Per Bulan' : 'Per Tahun'}
              </button>
            ))}
          </div>
          {periodMode === 'month' ? (
            <input
              type="month"
              aria-label="Pilih bulan"
              value={month}
              max={currentMonth}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-maroon-700 focus:outline-none"
            />
          ) : (
            <select
              aria-label="Pilih tahun"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-maroon-700 focus:outline-none"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Ringkasan Kondisi per Jenis (saat filter Semua) */}
      {groupFilter === 'ALL' && stockGroupStats.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stockGroupStats.map((g) => {
            const needAttention = g.outOfStockCount + g.lowStockCount;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupFilter(g.id as GroupFilter)}
                className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-soft transition-all hover:border-maroon-300 hover:bg-maroon-50/20"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 group-hover:text-maroon-900">
                    {g.label}
                  </span>
                  {needAttention > 0 ? (
                    <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                      {needAttention} perlu pengadaan
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Stok aman
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-3 text-xs text-slate-500">
                  <span>
                    <strong className="text-sm text-slate-900">{g.totalSku}</strong> SKU
                  </span>
                  <span>·</span>
                  <span>
                    <strong className="text-sm text-slate-900">{g.totalStock.toLocaleString('id-ID')}</strong> unit
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* KPI Arus Periode */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Barang Masuk"
          value={data?.kpi?.totalInQuantity ?? '...'}
          subtitle={`Penerimaan ${periodLabel}`}
          icon={ArrowDownToLine}
          variant="success"
        />

        <KPICard
          title="Total Barang Keluar"
          value={data?.kpi?.totalOutQuantity ?? '...'}
          subtitle="Distribusi unit & pemasangan"
          icon={ArrowUpFromLine}
          variant="maroon"
        />

        <KPICard
          title="Selisih (Net)"
          value={
            data?.kpi?.netMovement !== undefined
              ? data.kpi.netMovement > 0
                ? `+${data.kpi.netMovement}`
                : data.kpi.netMovement
              : '...'
          }
          subtitle="Selisih Masuk vs Keluar"
          icon={TrendingUp}
          variant="default"
        />

        <KPICard
          title="Perlu Pengadaan"
          value={data ? criticalItems.length : '...'}
          subtitle={
            data
              ? `${data.kpi.outOfStockCount} habis · ${data.kpi.lowStockCount} menipis`
              : 'Barang habis & menipis'
          }
          icon={AlertTriangle}
          variant="danger"
          badge={criticalItems.length > 0 ? 'Usulkan Beli' : 'Aman'}
        />
      </div>

      {/* Grafik Arus Persediaan Dinamis */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Dinamika Arus Persediaan ({periodLabel})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Perbandingan volume penerimaan (IN) vs pengeluaran (OUT) {data?.trendGranularity === 'monthly' ? 'per bulan' : isWeekly ? 'per minggu' : 'per hari'}
            </p>
          </div>
          {loading && <span className="text-[11px] text-slate-400">Memperbarui data...</span>}
        </div>
        <div className="pt-4">
          <StockChart data={data?.dailyTrends || []} />
        </div>
      </div>

      {/* Tabel Utama: Daftar Usulan Pengadaan Barang */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900">
              <ClipboardList className="h-4 w-4 text-maroon-700" />
              Daftar Usulan Pengadaan Barang
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Barang habis & menipis pada {periodLabel}: sisa dari periode sebelumnya ditambah barang yang masuk
            </p>
          </div>
          {criticalItems.length > 0 && (
            <span className="self-start rounded-full border border-maroon-200 bg-maroon-50 px-2.5 py-1 text-xs font-semibold text-maroon-800 sm:self-auto">
              {criticalItems.length} barang diusulkan
            </span>
          )}
        </div>

        {criticalItems.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
            <p className="mt-2 text-sm font-semibold text-slate-800">Semua persediaan masih aman</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Tidak ada barang yang habis atau mencapai batas minimum pada pilihan jenis stok ini.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs tabular-nums">
                <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nama Barang</th>
                    <th className="px-3 py-3 text-right font-semibold">Stok Sisa</th>
                    <th className="px-3 py-3 text-right font-semibold">Stok Masuk</th>
                    <th className="px-4 py-3 text-right font-semibold">Jumlah Stok</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {criticalItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="font-mono text-[11px] text-slate-400">
                          {item.sku} · {item.stockGroupLabel} · {item.category}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-slate-700">
                        {item.remainingStock} {item.unit}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-emerald-700">
                        {item.incomingStock ? `+${item.incomingStock} ${item.unit}` : '-'}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-right font-bold ${
                          item.isZero ? 'text-rose-600' : 'text-slate-900'
                        }`}
                        title={`Sisa akhir periode ${item.closingStock} ${item.unit} · batas minimum ${item.minimumStock} ${item.unit}`}
                      >
                        {item.totalStock} {item.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[11px] text-slate-500">
              Stok Sisa = sisa {data?.period?.openingLabel ?? 'awal periode'} · Stok Masuk = barang masuk selama {periodLabel} · Jumlah Stok = Stok Sisa + Stok Masuk. Penambahan stok dilakukan di menu Barang.
            </div>
          </>
        )}
      </section>

      {/* Riwayat Stok Lama & Stok Baru per Bulan / Tahun */}
      <StockPositionSection periode={periode} jenis={groupFilter === 'ALL' ? undefined : groupFilter} />

      {/* Analitik Bawah: Top Barang Dipakai, Unit/Gedung Aktif, & Sebaran Kategori */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Top 10 Barang Paling Banyak Digunakan */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            Barang Paling Banyak Digunakan
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Konsumsi tertinggi {periodLabel}
          </p>

          <div className="divide-y divide-slate-100 text-xs">
            {topConsumed.length === 0 ? (
              <p className="text-center py-6 text-slate-400">Belum ada pemakaian barang pada periode ini.</p>
            ) : (
              topConsumed.map((item, idx) => (
                <div key={`${item.product.sku}-${idx}`} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-maroon-200 bg-maroon-50 text-[11px] font-bold text-maroon-800">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900" title={item.product.name}>
                        {item.product.name}
                      </p>
                      <span className="font-mono text-[10px] text-slate-400">
                        {item.txCount}x keluar · Sisa {item.product.currentStock} {item.product.unit}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 font-bold text-maroon-800">
                    {item.totalOut} {item.product.unit}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Unit / Gedung Paling Aktif */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 mb-1">
            <Building2 className="h-4 w-4 text-maroon-700" />
            Unit / Gedung Paling Aktif
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Penerima distribusi terbanyak {periodLabel}
          </p>

          <div className="divide-y divide-slate-100 text-xs">
            {topUnits.length === 0 ? (
              <p className="text-center py-6 text-slate-400">Belum ada distribusi selesai pada periode ini.</p>
            ) : (
              topUnits.map((u, idx) => (
                <div key={u.unit} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900" title={u.unit}>
                        {u.unit}
                      </p>
                      <span className="text-[11px] text-slate-400">{u.itemLines} baris barang diterima</span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono font-bold text-slate-800">
                    {u.distributions}x
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sebaran Stok per Kategori */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 mb-1">
            <Layers className="h-4 w-4 text-maroon-700" />
            Sebaran Stok per Kategori
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Jumlah jenis barang dan total persediaan aktif
          </p>

          <div className="divide-y divide-slate-100 text-xs">
            {categoryStats.length === 0 ? (
              <p className="text-center py-6 text-slate-400">Belum ada data kategori.</p>
            ) : (
              categoryStats.map((cat) => (
                <div key={cat.name} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{cat.name}</p>
                    <span className="text-[11px] text-slate-400">
                      {cat.itemCount} barang
                      {cat.criticalCount > 0 ? (
                        <span className="ml-1 font-medium text-rose-600">· {cat.criticalCount} kritis</span>
                      ) : null}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono font-bold text-slate-800">
                    {cat.totalStock.toLocaleString('id-ID')} unit
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
