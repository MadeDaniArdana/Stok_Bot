'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Download, History, Printer, Search } from 'lucide-react';
import { fetchSwrJson, getSwrCache } from '@/lib/client-swr';
import { formatStock } from '@/lib/product-units';
import { getCurrentReportMonth } from '@/lib/report-period';

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

function qty(row: StockPositionRow, value: number) {
  return value < 0 ? `-${formatStock(row, -value)}` : formatStock(row, value);
}

/**
 * Riwayat stok per bulan/tahun: Stok Lama (awal periode), Stok Baru (masuk), Total, Keluar, dan Sisa Akhir.
 * Bisa dicetak A4 dan diunduh CSV sesuai periode & jenis stok yang dipilih.
 */
export function StockPositionSection({ jenis }: { jenis?: string }) {
  const currentMonth = getCurrentReportMonth();
  const currentYear = Number(currentMonth.slice(0, 4));
  const [mode, setMode] = useState<Mode>('month');
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(String(currentYear));
  const [search, setSearch] = useState('');
  const [onlyMoved, setOnlyMoved] = useState(false);

  const periode = mode === 'year' ? year : month;
  const params = new URLSearchParams({ periode });
  if (jenis) params.set('jenis', jenis);
  const queryStr = params.toString();
  const url = `/api/reports/stock-position?${queryStr}`;

  const [data, setData] = useState<StockPositionReport | null>(() => getSwrCache<StockPositionReport>(url) ?? null);
  const [loading, setLoading] = useState(() => !getSwrCache(url));
  const [error, setError] = useState<string | null>(null);

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

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);
    return years;
  }, [currentYear]);

  const rows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('id-ID');
    return (data?.rows || []).filter((row) => {
      if (onlyMoved && row.inQty === 0 && row.outQty === 0 && row.adjustment === 0) return false;
      if (!keyword) return true;
      return `${row.name} ${row.sku} ${row.category}`.toLocaleLowerCase('id-ID').includes(keyword);
    });
  }, [data, search, onlyMoved]);

  const showAdj = Boolean(data?.hasAdjustment);
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
        </div>
      </div>

      {/* Pilihan periode */}
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <div className="flex items-center gap-1 rounded-lg bg-slate-200/60 p-1 text-xs">
            {(['month', 'year'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 font-medium transition-all ${
                  mode === m ? 'bg-white font-bold text-maroon-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m === 'month' ? 'Per Bulan' : 'Per Tahun'}
              </button>
            ))}
          </div>
          {mode === 'month' ? (
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
            <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Barang</th>
                <th className="px-3 py-3 font-semibold">Jenis</th>
                <th className="px-3 py-3 text-right font-semibold">Stok Lama</th>
                <th className="px-3 py-3 text-right font-semibold text-emerald-700">Stok Baru</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                <th className="px-3 py-3 text-right font-semibold text-maroon-800">Keluar</th>
                {showAdj && <th className="px-3 py-3 text-right font-semibold">Penyesuaian</th>}
                <th className="px-4 py-3 text-right font-semibold">Sisa Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!data && loading ? (
                <tr>
                  <td colSpan={showAdj ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                    Memuat riwayat stok...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={showAdj ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                    Tidak ada barang yang cocok pada periode ini.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-slate-900">{row.name}</p>
                      <p className="font-mono text-[11px] text-slate-400">
                        {row.sku} · {row.category}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{row.stockGroupLabel}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-700">{qty(row, row.openingStock)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-emerald-700">
                      {row.inQty ? `+${qty(row, row.inQty)}` : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-slate-900">
                      {qty(row, row.totalAvailable)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-maroon-800">
                      {row.outQty ? `-${qty(row, row.outQty)}` : '-'}
                    </td>
                    {showAdj && (
                      <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">
                        {row.adjustment ? `${row.adjustment > 0 ? '+' : ''}${qty(row, row.adjustment)}` : '-'}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold text-slate-900">
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
