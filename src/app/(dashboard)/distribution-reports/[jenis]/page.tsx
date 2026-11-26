'use client';

import { Fragment, Suspense, use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound, useSearchParams } from 'next/navigation';
import {
  Building2,
  Camera,
  Link2,
  LoaderCircle,
  ChevronDown,
  Download,
  FileText,
  Layers,
  Package,
  Plus,
  Printer,
  Search,
  Undo2,
  X,
} from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { ProofLinkBox } from '@/components/distribution/ProofLinkBox';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { getCurrentReportMonth } from '@/lib/report-period';
import { getStockGroup, parseStockGroup, type StockGroup } from '@/lib/stock-groups';
import { personName } from '@/lib/deleted-account';
import { fetchSwrJson, getSwrCache, invalidateSwrPrefix } from '@/lib/client-swr';
import { clearDistributionBootstrapCache } from '@/lib/distribution-bootstrap';
import { formatItemQuantity } from '@/lib/product-units';

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));

const formatMonth = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 15)));
};

function ReportsContent({ stockGroup }: { stockGroup: StockGroup }) {
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const group = getStockGroup(stockGroup);

  const initialMonth = searchParams.get('month') || getCurrentReportMonth();
  const [month, setMonth] = useState(initialMonth);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const initialUrl = `/api/distributions?${new URLSearchParams({ jenis: group.id, month: initialMonth, status: 'all', page: '1' })}`;
  const [data, setData] = useState<any>(() => getSwrCache(initialUrl) ?? null);
  const [loading, setLoading] = useState(() => !getSwrCache(initialUrl));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  // Link foto bukti (Peralatan Listrik): dibuat ulang saat diminta karena link lama tidak disimpan.
  const [proofLink, setProofLink] = useState<{ row: any; token: string } | null>(null);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const latestRequest = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = async (force = false) => {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++latestRequest.current;
    const query = new URLSearchParams({ jenis: group.id, month, status, page: String(page) });
    if (debouncedSearch) query.set('search', debouncedSearch);
    const url = `/api/distributions?${query}`;
    const cached = getSwrCache<any>(url);
    if (cached && !force) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const json = await fetchSwrJson<any>(url, { force, signal: controller.signal });
      if (requestId === latestRequest.current) setData(json);
    } catch (error: any) {
      if (error?.name !== 'AbortError' && requestId === latestRequest.current) {
        showToast('Gagal Memuat', error.message, 'error');
      }
    } finally {
      if (requestId === latestRequest.current && !controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, month, debouncedSearch, status, page]);

  const submitCancel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cancelTarget || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/distributions/${cancelTarget.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal membatalkan distribusi.');
      showToast('Distribusi Dibatalkan', `${cancelTarget.number}: stok barang sudah dikembalikan.`);
      setCancelTarget(null);
      invalidateSwrPrefix('/api/distributions');
      invalidateSwrPrefix('/api/products');
      invalidateSwrPrefix('/api/reports/summary');
      clearDistributionBootstrapCache();
      load(true);
    } catch (error: any) {
      showToast('Gagal Membatalkan', error.message, 'error');
    } finally {
      setCancelling(false);
    }
  };

  const createProofLink = async (row: any) => {
    if (row.proofTokenHash && !confirm('Membuat link baru akan menonaktifkan link foto yang sudah pernah dikirim. Lanjutkan?')) return;
    setLinkBusyId(row.id);
    try {
      const res = await fetch(`/api/distributions/${row.id}/proof-link`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Link foto gagal dibuat.');
      setProofLink({ row, token: json.token });
    } catch (error: any) {
      showToast('Gagal Membuat Link', error.message, 'error');
    } finally {
      setLinkBusyId(null);
    }
  };

  const summary = data?.summary;
  const reportQuery = `jenis=${group.slug}&month=${month}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">Laporan Distribusi {group.label}</h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Riwayat dokumen dan rekap pengiriman {group.label} per bulan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/print/distribution-report?${reportQuery}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-soft hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> Cetak Laporan
          </a>
          <a
            href={`/api/distributions/export?${reportQuery}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-soft hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Unduh Excel
          </a>
          <Link
            href={`/distribution/${group.slug}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-maroon-800 px-4 py-2.5 text-xs font-semibold text-white shadow-soft hover:bg-maroon-900"
          >
            <Plus className="h-4 w-4" /> Form Baru
          </Link>
        </div>
      </div>

      {/* Filter */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-soft sm:grid-cols-[10rem_1fr_11rem]">
        <div>
          <label htmlFor="report-month" className="sr-only">Bulan</label>
          <input
            id="report-month"
            type="month"
            value={month}
            onChange={(e) => {
              if (!e.target.value) return;
              setMonth(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20"
          />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <label htmlFor="report-search" className="sr-only">Cari</label>
          <input
            id="report-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Cari no. dokumen, ${group.recipientLabel.toLowerCase()}, penerima, atau barang...`}
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-xs focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20"
          />
        </div>
        <div>
          <label htmlFor="report-status" className="sr-only">Status</label>
          <select
            id="report-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20"
          >
            <option value="all">Semua Status</option>
            <option value="COMPLETED">Selesai</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
        </div>
      </div>

      {data?.availableMonths?.length > 0 && (
        <div className="-mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-500">Bulan berisi data:</span>
          {data.availableMonths.map((option: { month: string; documents: number }) => (
            <button
              key={option.month}
              type="button"
              onClick={() => {
                setMonth(option.month);
                setPage(1);
              }}
              className={cn(
                'rounded-full border px-2.5 py-0.5 font-semibold transition-colors',
                option.month === month ? 'border-maroon-700 bg-maroon-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-maroon-300 hover:text-maroon-900'
              )}
            >
              {formatMonth(option.month)} ({option.documents})
            </button>
          ))}
        </div>
      )}

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Dokumen Distribusi" value={summary?.documents ?? '...'} subtitle={formatMonth(month)} icon={FileText} variant="maroon" />
        <KPICard title="Baris Barang" value={summary?.itemLines ?? '...'} subtitle="Total item keluar" icon={Layers} />
        <KPICard title="Jenis Barang" value={summary?.productKinds ?? '...'} subtitle="Barang berbeda" icon={Package} variant="success" />
        <KPICard title={group.id === 'LISTRIK' ? 'Ruang Dilayani' : 'Unit Penerima'} value={summary?.units ?? '...'} subtitle="Tujuan berbeda" icon={Building2} variant="warning" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <h2 className="text-sm font-bold text-slate-900">Rekap per Barang</h2>
          <p className="mb-3 text-xs text-slate-500">Jumlah keluar selama {formatMonth(month)} (tanpa dokumen dibatalkan)</p>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2 pr-2">Barang</th>
                  <th className="py-2 px-2 text-center">Dokumen</th>
                  <th className="py-2 pl-2 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!summary?.byProduct?.length ? (
                  <tr><td colSpan={3} className="py-6 text-center text-slate-400">Belum ada distribusi.</td></tr>
                ) : (
                  summary.byProduct.map((item: any) => (
                    <tr key={item.productId}>
                      <td className="py-2 pr-2">
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        <p className="font-mono text-[10px] text-slate-400">{item.sku}</p>
                      </td>
                      <td className="py-2 px-2 text-center text-slate-500">{item.documents}</td>
                      <td className="py-2 pl-2 text-right font-bold text-maroon-800">{formatItemQuantity(item.quantity, item.unit, item)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <h2 className="text-sm font-bold text-slate-900">Rekap per {group.recipientLabel === 'Ruang' ? 'Ruang' : 'Unit Penerima'}</h2>
          <p className="mb-3 text-xs text-slate-500">Unit yang paling sering menerima barang</p>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2 pr-2">{group.recipientLabel}</th>
                  <th className="py-2 px-2 text-center">Dokumen</th>
                  <th className="py-2 pl-2 text-right">Baris Barang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!summary?.byUnit?.length ? (
                  <tr><td colSpan={3} className="py-6 text-center text-slate-400">Belum ada distribusi.</td></tr>
                ) : (
                  summary.byUnit.map((unit: any) => (
                    <tr key={unit.unit}>
                      <td className="py-2 pr-2 font-semibold text-slate-800">{unit.unit}</td>
                      <td className="py-2 px-2 text-center text-slate-500">{unit.documents}</td>
                      <td className="py-2 pl-2 text-right font-bold text-slate-800">{unit.itemLines}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Riwayat dokumen */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">Riwayat Dokumen</h2>
          <p className="text-xs text-slate-500">{data?.total ?? 0} dokumen pada {formatMonth(month)}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase font-semibold text-slate-500">
              <tr>
                <th className="px-3 py-3 whitespace-nowrap">Dokumen</th>
                <th className="px-2.5 py-3">{group.recipientLabel}</th>
                <th className="px-2.5 py-3">Barang</th>
                <th className="px-2.5 py-3">{group.id === 'LISTRIK' ? 'Petugas' : 'Penerima'}</th>
                <th className="px-2.5 py-3 text-center">Status</th>
                <th className="px-3 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading && !data ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400">Memuat riwayat...</td></tr>
              ) : !data?.items?.length ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400">Belum ada dokumen distribusi yang cocok.</td></tr>
              ) : (
                data.items.map((row: any) => {
                  const isOpen = expanded === row.id;
                  const cancelled = row.status === 'CANCELLED';
                  const first = row.items[0];
                  return (
                    <Fragment key={row.id}>
                      <tr className={cn('hover:bg-slate-50/70', cancelled && 'text-slate-400')}>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          <div className="font-mono font-semibold text-slate-900">{row.number}</div>
                          <div className="text-xs text-slate-400">{formatDate(row.distributedAt)}</div>
                        </td>
                        <td className="px-2.5 py-2.5 font-semibold max-w-[12rem] leading-snug">{row.recipientUnit}</td>
                        <td className="px-2.5 py-2.5 max-w-[18rem]">
                          <button
                            type="button"
                            onClick={() => setExpanded(isOpen ? null : row.id)}
                            aria-expanded={isOpen}
                            className="inline-flex items-center gap-1 text-left leading-snug hover:text-maroon-800"
                          >
                            <span>
                              {first ? `${first.product.name} (${formatItemQuantity(first.quantity, first.unit, first.product)})` : '-'}
                              {row.items.length > 1 && <span className="text-slate-400"> +{row.items.length - 1} lainnya</span>}
                            </span>
                            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')} />
                          </button>
                        </td>
                        <td className="px-2.5 py-2.5 max-w-[10rem] leading-snug">{group.id === 'LISTRIK' ? row.handoverName : row.receiverName || '-'}</td>
                        <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                          {cancelled ? (
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Dibatalkan</span>
                          ) : (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Selesai</span>
                          )}
                          {group.id === 'LISTRIK' && !cancelled && (() => {
                            const locations = Array.from(new Set<string>((row.items || []).map((item: any) => item.location || row.recipientUnit)));
                            const proofs: { location: string }[] = row.proofs || [];
                            const photoLink = (query: string, label: string) => (
                              <a
                                key={label}
                                href={`/api/distributions/${row.id}/photo${query}`}
                                target="_blank"
                                rel="noopener"
                                className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold text-emerald-700 hover:underline"
                              >
                                <Camera className="h-3 w-3" /> {label}
                              </a>
                            );
                            // Dokumen lama: satu foto di level dokumen.
                            if (row.proofFileName && proofs.length === 0) return photoLink('', 'Lihat foto');
                            if (locations.length <= 1) {
                              return row.proofFileName ? photoLink(proofs[0] ? `?location=${encodeURIComponent(proofs[0].location)}` : '', 'Lihat foto') : (
                                <span className="mt-1 block text-[10px] font-semibold text-amber-700">Menunggu foto</span>
                              );
                            }
                            return (
                              <>
                                {proofs.map((proof) => photoLink(`?location=${encodeURIComponent(proof.location)}`, `Foto ${proof.location}`))}
                                {proofs.length < locations.length && (
                                  <span className="mt-1 block text-[10px] font-semibold text-amber-700">Menunggu foto ({proofs.length}/{locations.length})</span>
                                )}
                              </>
                            );
                          })()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <a
                              href={`/print/distribution/${row.id}`}
                              target="_blank"
                              rel="noopener"
                              className="action-button action-icon action-neutral"
                              aria-label={`Cetak ${row.number}`}
                              title="Cetak form"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </a>
                            {group.id === 'LISTRIK' && !cancelled && !row.proofFileName && (
                              <button
                                type="button"
                                disabled={linkBusyId === row.id}
                                onClick={() => createProofLink(row)}
                                className="action-button action-icon action-edit"
                                aria-label={`Link foto bukti ${row.number}`}
                                title="Buat & kirim link foto bukti"
                              >
                                <Link2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {!cancelled && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelTarget(row);
                                  setCancelReason('');
                                }}
                                className="action-button action-icon action-danger"
                                aria-label={`Batalkan ${row.number}`}
                                title="Batalkan & kembalikan stok"
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={6} className="px-4 pb-4 pt-1">
                            <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1fr_16rem]">
                              <table className="w-full text-xs">
                                <thead className="text-[11px] text-slate-400">
                                  <tr>
                                    <th className="w-8 py-1 text-left">No</th>
                                    <th className="py-1 text-left">Nama Barang</th>
                                    <th className="py-1 text-right">Jumlah</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {row.items.map((item: any, index: number) => (
                                    <tr key={item.id}>
                                      <td className="py-1.5 text-slate-400">{index + 1}</td>
                                      <td className="py-1.5 font-medium text-slate-800">{item.product.name}</td>
                                      <td className="py-1.5 text-right font-semibold">{formatItemQuantity(item.quantity, item.unit, item.product)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <dl className="space-y-1.5 text-[11px] text-slate-500">
                                {row.orderNumber && <div><dt className="inline font-semibold">No. Nota: </dt><dd className="inline">{row.orderNumber}</dd></div>}
                                {row.storageLocation && <div><dt className="inline font-semibold">Penyimpanan: </dt><dd className="inline">{row.storageLocation}</dd></div>}
                                <div><dt className="inline font-semibold">{group.handoverLabel}: </dt><dd className="inline">{row.handoverName}</dd></div>
                                {row.receiverName && <div><dt className="inline font-semibold">Penerima: </dt><dd className="inline">{row.receiverName}</dd></div>}
                                {row.notes && <div><dt className="inline font-semibold">Catatan: </dt><dd className="inline">{row.notes}</dd></div>}
                                {(row.creator || row.creatorName) && <div><dt className="inline font-semibold">Dicatat oleh: </dt><dd className="inline">{personName(row.creator?.name, row.creatorName)}</dd></div>}
                                {cancelled && <div className="text-rose-600"><dt className="inline font-semibold">Alasan batal: </dt><dd className="inline">{row.cancelReason}</dd></div>}
                              </dl>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">
              Sebelumnya
            </button>
            <span className="text-slate-500">Halaman {data.page} dari {data.totalPages}</span>
            <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40">
              Berikutnya
            </button>
          </div>
        )}
      </section>

      {proofLink && (
        <ModalOverlay role="dialog" aria-modal="true" aria-labelledby="proof-link-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 id="proof-link-title" className="text-base font-bold text-slate-900">Link Foto {proofLink.row.number}</h3>
              <button type="button" onClick={() => setProofLink(null)} aria-label="Tutup" className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ProofLinkBox
              token={proofLink.token}
              officerName={proofLink.row.handoverName}
              phone={proofLink.row.officerPhone}
              location={proofLink.row.recipientUnit}
              itemsLabel={proofLink.row.items.map((item: any) => `${item.product.name} (${formatItemQuantity(item.quantity, item.unit, item.product)})`).join(', ')}
            />
          </div>
        </ModalOverlay>
      )}

      {cancelTarget && (
        <ModalOverlay role="dialog" aria-modal="true" aria-labelledby="cancel-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <form onSubmit={submitCancel} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 id="cancel-title" className="text-base font-bold text-slate-900">Batalkan {cancelTarget.number}?</h3>
              <button type="button" onClick={() => setCancelTarget(null)} aria-label="Tutup" className="rounded-lg p-1 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-600">
              Stok {cancelTarget.items.length} barang akan dikembalikan lewat transaksi pembalik. Dokumen tetap tersimpan dengan status Dibatalkan untuk keperluan audit.
            </p>
            <label htmlFor="cancel-reason" className="mt-4 block text-xs font-semibold text-slate-700">
              Alasan pembatalan <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="cancel-reason"
              required
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Contoh: barang dikembalikan karena salah kirim"
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCancelTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Kembali
              </button>
              <button type="submit" disabled={cancelling || !cancelReason.trim()} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                {cancelling && <LoaderCircle className="mr-1.5 inline h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                {cancelling ? 'Mengembalikan stok...' : 'Batalkan Distribusi'}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </div>
  );
}

/** Laporan Distribusi ATK / Peralatan Listrik / Logistik. */
export default function DistributionReportsPage({ params }: { params: Promise<{ jenis: string }> }) {
  const { jenis } = use(params);
  const stockGroup = parseStockGroup(jenis);
  if (!stockGroup) notFound();
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Memuat laporan distribusi...</div>}>
      <ReportsContent key={stockGroup} stockGroup={stockGroup} />
    </Suspense>
  );
}
