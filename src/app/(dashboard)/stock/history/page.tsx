'use client';

import { ModalOverlay } from '@/components/ui/ModalOverlay';

import React, { useState, useEffect, useRef } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  RotateCcw,
  Send,
  Globe,
  ArrowDownLeft,
  ArrowUpRight,
  X,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/layout/AuthContext';
import { personName } from '@/lib/deleted-account';

export default function StockHistoryPage() {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [productId, setProductId] = useState('all');
  const [type, setType] = useState('all');
  const [source, setSource] = useState('all');
  const [actorUserId, setActorUserId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Reversal Modal
  const [reversalTarget, setReversalTarget] = useState<any | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  const movementsAbortRef = useRef<AbortController | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const fetchMovements = async () => {
    movementsAbortRef.current?.abort();
    const controller = new AbortController();
    movementsAbortRef.current = controller;
    try {
      setLoading(true);
      const query = new URLSearchParams({
        productId,
        type,
        source,
        actorUserId,
        startDate,
        endDate,
        limit: '100',
      }).toString();

      const res = await fetch(`/api/stock/movements?${query}`, { signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        if (!controller.signal.aborted) setMovements(data.items || []);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.error(e);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    // Muat daftar barang dan pengguna secara paralel untuk dropdown filter.
    const controller = new AbortController();
    Promise.all([
      fetch('/api/products?limit=500', { signal: controller.signal }).then((r) => (r.ok ? r.json() : { items: [] })),
      fetch('/api/users', { signal: controller.signal }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([prodData, usersData]) => {
        if (controller.signal.aborted) return;
        setProducts(prodData.items || []);
        setUsers(usersData || []);
      })
      .catch((e: any) => {
        if (e?.name !== 'AbortError') console.error(e);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    fetchMovements();
    return () => movementsAbortRef.current?.abort();
  }, [productId, type, source, actorUserId, startDate, endDate]);

  // Handle Reversal / Correction
  const handleReversalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget || !reversalReason.trim()) return;

    try {
      setIsReversing(true);
      const res = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalMovementId: reversalTarget.id,
          actorUserId: currentUser?.id,
          reason: reversalReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(
        'Koreksi Transaksi Berhasil Dicatat',
        `Movement pembalik telah dibuat dan saldo persediaan telah disesuaikan kembali.`
      );
      setReversalTarget(null);
      setReversalReason('');
      fetchMovements();
    } catch (err: any) {
      showToast('Gagal Melakukan Koreksi', err.message, 'error');
    } finally {
      setIsReversing(false);
    }
  };

  // Export CSV function
  const handleExportCSV = () => {
    if (movements.length === 0) {
      showToast('Tidak Ada Data', 'Tidak ada data untuk diekspor pada filter ini.', 'error');
      return;
    }

    const headers = [
      'Waktu',
      'SKU',
      'Nama Barang',
      'Aktivitas',
      'Jumlah',
      'Satuan',
      'Stok Sebelum',
      'Stok Sesudah',
      'Pelaku',
      'Sumber',
      'Catatan',
    ];

    const rows = movements.map((m) => [
      `"${new Date(m.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}"`,
      `"${m.product?.sku || ''}"`,
      `"${m.product?.name || ''}"`,
      `"${m.type}"`,
      m.quantity,
      `"${m.product?.unit || ''}"`,
      m.stockBefore,
      m.stockAfter,
      `"${m.source === 'TELEGRAM' && m.actor?.telegram?.username ? '@' + m.actor.telegram.username : personName(m.actor?.name, m.actorName, 'Sistem')}"`,
      `"${m.source}"`,
      `"${(m.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `StockFlow-Mutasi-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Ekspor Berhasil', 'File CSV riwayat pergerakan stok telah diunduh.');
  };

  // Export PDF: ambil seluruh transaksi sesuai filter aktif (bukan hanya 100 baris di layar).
  const handleExportPDF = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const { fetchAllMovements, downloadStockMovementsPdf } = await import('@/lib/stock-movements-pdf');
      const all = await fetchAllMovements({ productId, type, source, actorUserId, startDate, endDate });
      if (all.length === 0) {
        showToast('Tidak Ada Data', 'Tidak ada data untuk diekspor pada filter ini.', 'error');
        return;
      }
      const fmtDate = (value: string) =>
        new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
      const typeLabels: Record<string, string> = { IN: 'Masuk', OUT: 'Keluar', ADJUSTMENT: 'Penyesuaian', REVERSAL: 'Pembatalan' };
      const filterLines = [
        startDate || endDate
          ? `Periode: ${startDate ? fmtDate(startDate) : 'awal'} s/d ${endDate ? fmtDate(endDate) : 'sekarang'}`
          : 'Periode: semua tanggal',
        productId !== 'all' ? `Barang: ${products.find((p) => p.id === productId)?.name || '-'}` : '',
        type !== 'all' ? `Aktivitas: ${typeLabels[type] || type}` : '',
        source !== 'all' ? `Sumber: ${source}` : '',
        actorUserId !== 'all' ? `Pelaku: ${users.find((u) => u.id === actorUserId)?.name || '-'}` : '',
      ].filter(Boolean);
      await downloadStockMovementsPdf(all, filterLines);
      showToast('Ekspor Berhasil', `File PDF berisi ${all.length} transaksi telah diunduh.`);
    } catch (e: any) {
      showToast('Gagal Ekspor PDF', e?.message || 'PDF gagal dibuat.', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight text-balance">
            Riwayat Stok
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Catatan setiap barang masuk dan keluar: kapan, oleh siapa, dan sisa stok sesudahnya
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="action-button action-success"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor ke CSV</span>
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exportingPdf}
            className="action-button action-danger disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            <span>{exportingPdf ? 'Membuat PDF...' : 'Ekspor ke PDF'}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-soft space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Filter Product */}
          <div className="lg:col-span-2">
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
            >
              <option value="all">Semua Barang</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Type */}
          <div>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
            >
              <option value="all">Tipe: Semua</option>
              <option value="IN">Masuk (IN)</option>
              <option value="OUT">Keluar (OUT)</option>
              <option value="REVERSAL">Pembalik (REVERSAL)</option>
            </select>
          </div>

          {/* Filter Source */}
          <div>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full text-xs px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700 bg-white"
            >
              <option value="all">Sumber: Semua</option>
              <option value="WEB">Website</option>
              <option value="TELEGRAM">Telegram Bot</option>
              <option value="SYSTEM">Sistem Awal</option>
            </select>
          </div>

          {/* Date Range Start */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Dari Tanggal"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
            />
          </div>

          {/* Date Range End */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="Sampai Tanggal"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
            />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4">Waktu (WIB)</th>
                <th className="py-3.5 px-4">Barang & SKU</th>
                <th className="py-3.5 px-4 text-center">Tipe</th>
                <th className="py-3.5 px-4 text-right">Perubahan</th>
                <th className="py-3.5 px-4 text-center">Stok Sebelum &rarr; Sesudah</th>
                <th className="py-3.5 px-4">Aktor / Pemakai</th>
                <th className="py-3.5 px-4 text-center">Sumber</th>
                <th className="py-3.5 px-4">Catatan / Dokumen</th>
                {isAdmin && <th className="py-3.5 px-4 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Memuat riwayat stok...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Belum ada transaksi pada kriteria filter ini.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isIncoming = m.type === 'IN';
                  const isReversal = m.type === 'REVERSAL';
                  const isTelegram = m.source === 'TELEGRAM';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-mono">
                        {new Date(m.createdAt).toLocaleString('id-ID', {
                          timeZone: 'Asia/Jakarta',
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{m.product?.name || '-'}</p>
                        <span className="font-mono text-[11px] text-slate-400">
                          {m.product?.sku || '-'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            isReversal
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : isIncoming
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isReversal ? (
                            <RotateCcw className="w-2.5 h-2.5" />
                          ) : isIncoming ? (
                            <ArrowDownLeft className="w-2.5 h-2.5" />
                          ) : (
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          )}
                          {m.type}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-extrabold text-sm whitespace-nowrap">
                        <span
                          className={
                            isIncoming
                              ? 'text-emerald-600'
                              : isReversal
                              ? 'text-purple-600'
                              : 'text-maroon-800'
                          }
                        >
                          {isIncoming ? '+' : isReversal ? '↺ ' : '-'}
                          {m.quantity} {m.product?.unit}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {m.stockBefore} &rarr;{' '}
                        <strong className="text-slate-900 font-bold">{m.stockAfter}</strong>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-800">{isTelegram && m.actor?.telegram?.username ? `@${m.actor.telegram.username}` : personName(m.actor?.name, m.actorName, 'Sistem')}</p>
                        {!isTelegram && m.actor?.email && (
                          <span className="text-[10px] text-slate-400">{m.actor.email}</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {isTelegram ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200 font-semibold">
                            <Send className="w-2.5 h-2.5" /> Telegram
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">
                            <Globe className="w-2.5 h-2.5" /> Web
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-slate-600 line-clamp-2 text-[11px] leading-relaxed">
                          {m.notes || '-'}
                        </p>
                        {m.referenceId && (
                          <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">
                            Ref: {m.referenceId}
                          </span>
                        )}
                      </td>

                      {isAdmin && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {m.type !== 'REVERSAL' && (
                            <button
                              onClick={() => {
                                setReversalTarget(m);
                                setReversalReason('');
                              }}
                              className="action-button action-reversal"
                              title="Buat Koreksi Pembalik Transaksi"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Koreksi
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Koreksi / Reversal */}
      {reversalTarget && (
        <ModalOverlay className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-purple-700" />
                Koreksi Pembalik Transaksi
              </h3>
              <button
                onClick={() => setReversalTarget(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReversalSubmit} className="space-y-4 pt-4 text-sm">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-900 text-xs">
                <p className="font-bold">Detail Transaksi yang Akan Dibalik:</p>
                <p className="mt-1">
                  Barang: <strong>{reversalTarget.product?.name}</strong>
                </p>
                <p>
                  Kuantitas: {reversalTarget.type === 'IN' ? 'Masuk' : 'Keluar'}{' '}
                  <strong>
                    {reversalTarget.quantity} {reversalTarget.product?.unit}
                  </strong>
                </p>
                <p className="text-[11px] text-purple-700 mt-2">
                  ℹ️ Sesuai kaidah audit PRD, transaksi lama tidak akan dihapus. Sistem akan membuat transaksi baru bertipe <strong>REVERSAL</strong> dengan merujuk ID transaksi ini.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Koreksi / Pembalik <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="Misal: Salah input kuantitas barang oleh staff, atau barang dikembalikan utuh ke gudang"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-700 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReversalTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isReversing || !reversalReason.trim()}
                  className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-semibold transition-colors disabled:opacity-50"
                >
                  {isReversing ? 'Memproses...' : 'Konfirmasi Koreksi'}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
