'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, History, Loader2, Printer, Search } from 'lucide-react';
import { fetchSwrJson, getSwrCache } from '@/lib/client-swr';
import { StockQty } from '@/components/ui/StockQty';
import { getStockGroup, parseStockGroup } from '@/lib/stock-groups';

type Mode = 'month' | 'year';

interface StockPositionRow {
  id: string;
  sku: string;
  name: string;
  category: string;
  stockGroupLabel: string;
  unit: string;
  packUnit: string | null;
  packSize: number | null;
  openingStock: number;
  inQty: number;
  totalAvailable: number;
  outQty: number;
  adjustment: number;
  closingStock: number;
}

interface StockPositionReport {
  period: { kind: Mode; value: string; label: string; openingLabel: string };
  hasAdjustment: boolean;
  totals: {
    openingStock: number;
    inQty: number;
    totalAvailable: number;
    outQty: number;
    adjustment: number;
    closingStock: number;
    itemCount: number;
    itemsWithIn: number;
    itemsWithOut: number;
  };
  rows: StockPositionRow[];
}

function qty(row: StockPositionRow, value: number, prefix = '') {
  const sign = value < 0 ? '-' : prefix;
  return <StockQty product={row} quantity={Math.abs(value)} prefix={sign} align="end" />;
}

/**
 * Riwayat stok per bulan/tahun: Stok Lama (awal periode), Stok Baru (masuk), Total, Keluar, dan Sisa Akhir.
 * Bisa dicetak A4 dan diunduh CSV sesuai periode & jenis stok yang dipilih.
 */
export function StockPositionSection({ periode, jenis }: { periode: string; jenis?: string }) {
  const mode: Mode = /^\d{4}$/.test(periode) ? 'year' : 'month';
  const [search, setSearch] = useState('');
  const [onlyMoved, setOnlyMoved] = useState(false);

  const params = new URLSearchParams({ periode });
  if (jenis) params.set('jenis', jenis);
  const queryStr = params.toString();
  const url = `/api/reports/stock-position?${queryStr}`;

  const [data, setData] = useState<StockPositionReport | null>(() => getSwrCache<StockPositionReport>(url) ?? null);
  const [loading, setLoading] = useState(() => !getSwrCache(url));
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (!data || exportingPdf) return;
    setExportingPdf(true);
    try {
      const group = parseStockGroup(jenis);
      const { downloadStockPositionPdf } = await import('@/lib/stock-position-pdf');
      await downloadStockPositionPdf(data, {
        groupLabel: group ? getStockGroup(group).label : 'Semua Jenis',
        groupSlug: group ? getStockGroup(group).slug : 'semua',
      });
    } catch (e: any) {
      setError(e?.message || 'PDF gagal dibuat.');
    } finally {
      setExportingPdf(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const cached = getSwrCache<StockPositionReport>(url);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    fetchSwrJson<StockPositionReport>(url, { signal: controller.signal })
      .then((json) => {
        if (!controller.signal.aborted) setData(json);
      })
      .catch((e: any) => {
        if (e?.name !== 'AbortError') setError(e?.message || 'Riwayat stok tidak dapat dimuat.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [url]);

  const rows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('id-ID');
    return (data?.rows || []).filter((row) => {
      if (onlyMoved && row.inQty === 0 && row.outQty === 0 && row.adjustment === 0) return false;
      if (!keyword) return true;
      return `${row.name} ${row.sku} ${row.category}`.toLocaleLowerCase('id-ID').includes(keyword);
    });
  }, [data, search, onlyMoved]);

  const showAdj = Boolean(data?.hasAdjustment);
  const showGroupCol = !jenis;
  const colCount = 6 + (showGroupCol ? 1 : 0) + (showAdj ? 1 : 0);
  const t = data?.totals;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900">
            <History className="h-4 w-4 text-maroon-700" />
            Riwayat Stok Lama & Stok Baru
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Stok awal periode, barang masuk, total, barang keluar, dan sisa akhir per barang
            {data ? ` · ${data.period.label}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/print/stock-position?${queryStr}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-soft hover:bg-slate-50"
          >
            <Printer className="h-4 w-4 text-maroon-700" />
            Cetak {mode === 'year' ? 'Tahunan' : 'Bulanan'}
          </a>
          <a
            href={`/api/reports/stock-position?${queryStr}&format=csv`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-maroon-200 bg-maroon-50 px-3 py-2 text-xs font-semibold text-maroon-800 shadow-soft hover:bg-maroon-100"
          >
            <Download className="h-4 w-4" />
            Export CSV {mode === 'year' ? 'Tahunan' : 'Bulanan'}
          </a>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!data || exportingPdf}
            className="inline-flex items-center gap-1.5 rounded-xl border border-maroon-700 bg-maroon-800 px-3 py-2 text-xs font-semibold text-white shadow-soft hover:bg-maroon-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Export PDF {mode === 'year' ? 'Tahunan' : 'Bulanan'}
          </button>
        </div>
      </div>

      {/* Pilihan periode */}
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          Periode: <strong className="text-slate-800">{data?.period.label ?? '...'}</strong>
          {loading && <span className="text-[11px] text-slate-400">Memuat...</span>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={onlyMoved}
              onChange={(e) => setOnlyMoved(e.target.checked)}
              className="h-3.5 w-3.5 accent-maroon-800"
            />
            Hanya yang ada mutasi
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari barang..."
              className="w-44 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-800 focus:border-maroon-700 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Ringkasan total periode */}
      {t && (
        <div className="grid grid-cols-2 gap-px bg-slate-100 text-center sm:grid-cols-4">
          {[
            { label: 'Stok Lama', value: t.openingStock, hint: data?.period.openingLabel },
            { label: 'Stok Baru (Masuk)', value: t.inQty, hint: `${t.itemsWithIn} barang` },
            { label: 'Keluar', value: t.outQty, hint: `${t.itemsWithOut} barang` },
            { label: 'Sisa Akhir', value: t.closingStock, hint: `${t.itemCount} barang` },
          ].map((s) => (
            <div key={s.label} className="bg-white px-3 py-3">
              <p className="text-[11px] font-medium text-slate-500">{s.label}</p>
              <p className="text-lg font-bold tabular-nums text-slate-900">{s.value.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-slate-400">{s.hint}</p>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <p className="p-6 text-center text-sm text-rose-600">{error}</p>
      ) : (
        <div className="max-h-[560px] overflow-auto border-t border-slate-100">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Barang</th>
                {showGroupCol && <th className="px-2.5 py-3 font-semibold whitespace-nowrap">Jenis</th>}
                <th className="px-2.5 py-3 text-right font-semibold whitespace-nowrap">Stok Lama</th>
                <th className="px-2.5 py-3 text-right font-semibold text-emerald-700 whitespace-nowrap">Stok Baru</th>
                <th className="px-2.5 py-3 text-right font-semibold whitespace-nowrap">Total</th>
                <th className="px-2.5 py-3 text-right font-semibold text-maroon-800 whitespace-nowrap">Keluar</th>
                {showAdj && <th className="px-2.5 py-3 text-right font-semibold whitespace-nowrap">Penyesuaian</th>}
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Sisa Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!data && loading ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-8 text-center text-slate-400">
                    Memuat riwayat stok...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada barang yang cocok pada periode ini.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 min-w-[11rem] max-w-[16rem]">
                      <p className="font-semibold text-slate-900 leading-snug">{row.name}</p>
                      <p className="font-mono text-[10px] text-slate-400">
                        {row.sku} · {row.category}
                      </p>
                    </td>
                    {showGroupCol && <td className="whitespace-nowrap px-2.5 py-2.5 text-slate-600">{row.stockGroupLabel}</td>}
                    <td className="px-2.5 py-2.5 text-right text-slate-700">{qty(row, row.openingStock)}</td>
                    <td className="px-2.5 py-2.5 text-right font-semibold text-emerald-700">
                      {row.inQty ? qty(row, row.inQty, '+') : '-'}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-semibold text-slate-900">
                      {qty(row, row.totalAvailable)}
                    </td>
                    <td className="px-2.5 py-2.5 text-right font-semibold text-maroon-800">
                      {row.outQty ? qty(row, row.outQty, '-') : '-'}
                    </td>
                    {showAdj && (
                      <td className="px-2.5 py-2.5 text-right text-slate-600">
                        {row.adjustment ? qty(row, row.adjustment, row.adjustment > 0 ? '+' : '') : '-'}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                      {qty(row, row.closingStock)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-2.5 text-[11px] text-slate-500">
        Stok Lama = stok {data?.period.openingLabel ?? 'awal periode'} · Total = Stok Lama + Stok Baru · Sisa Akhir = Total − Keluar
        {showAdj ? ' ± Penyesuaian' : ''}. Pembatalan distribusi otomatis mengurangi angka keluar.
      </div>
    </section>
  );
}
