'use client';

import { PhotoSlider } from '@/components/PhotoSlider';
import { ModalOverlay } from '@/components/ui/ModalOverlay';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Search, MapPin, User, Clock, CheckCircle2, Hourglass, X, ImageOff, ChevronLeft, ChevronRight, Send, Globe } from 'lucide-react';
import { getCurrentReportMonth, getReportMonthRange } from '@/lib/report-period';

interface TaskItem {
  id: string;
  /** TELEGRAM = tugas dari bot, WEB = Distribusi Peralatan Listrik */
  source: 'TELEGRAM' | 'WEB';
  reference: string | null;
  quantityLabel: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  assigneeName: string;
  location: string;
  notes: string | null;
  status: 'PENDING' | 'COMPLETED';
  creatorName: string;
  createdAt: string;
  completedAt: string | null;
  photoUrl: string | null;
  photos: { url: string; label: string }[];
  photoSlots: number;
}

const SOURCE_FILTERS = [
  { value: 'all', label: 'Semua sumber' },
  { value: 'TELEGRAM', label: 'Telegram' },
  { value: 'WEB', label: 'Web' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'Semua' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'PENDING', label: 'Menunggu foto' },
];

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InstallationReportPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<TaskItem | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [month, setMonth] = useState('');
  const [followCurrentMonth, setFollowCurrentMonth] = useState(true);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState({ total: 0, completedCount: 0, pendingCount: 0, totalPages: 1 });
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [loadedKey, setLoadedKey] = useState('');
  const reportKey = JSON.stringify([month, status, source, search, page]);
  const isLoading = loading || loadedKey !== reportKey;
  const monthLabel = month ? getReportMonthRange(month).gte.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta', month: 'long', year: 'numeric',
  }) : '';

  const changeMonth = (value: string) => {
    try {
      getReportMonthRange(value);
    } catch {
      return;
    }
    setMonth(value);
    setPage(1);
    setPreview(null);
    setFollowCurrentMonth(value === getCurrentReportMonth());
  };

  useEffect(() => {
    if (!followCurrentMonth) return;
    const syncMonth = () => {
      const currentMonth = getCurrentReportMonth();
      if (currentMonth !== month) {
        setMonth(currentMonth);
        setPage(1);
        setPreview(null);
      }
    };
    syncMonth();
    const timer = setInterval(syncMonth, 60_000);
    window.addEventListener('focus', syncMonth);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', syncMonth);
    };
  }, [followCurrentMonth, month]);

  useEffect(() => {
    if (!month) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setPreview(null);
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ status, search, month, page: String(page), ...(source !== 'all' ? { source } : {}) }).toString();
        const res = await fetch(`/api/tasks?${query}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Laporan tidak dapat dimuat.');
        if (controller.signal.aborted) return;
        setTasks(data.items || []);
        setSummary({ total: data.total, completedCount: data.completedCount, pendingCount: data.pendingCount, totalPages: data.totalPages });
        setPage(data.page);
      } catch (error) {
        if (!controller.signal.aborted) {
          setTasks([]);
          setError('Laporan tidak dapat dimuat. Silakan coba lagi.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadedKey(reportKey);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [status, source, search, month, page, retry, reportKey]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-semibold text-slate-900 tracking-tight text-balance">Laporan Pemasangan</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Semua bukti pemasangan, baik dari tugas bot Telegram maupun dari Distribusi Peralatan Listrik di web
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-soft space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="report-month" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" /> Bulan Laporan
            </label>
            <input id="report-month" type="month" min="1000-01" max="9999-12" required value={month} onChange={(e) => changeMonth(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700" />
            <button type="button" onClick={() => changeMonth(getCurrentReportMonth())} className="action-button action-neutral">Bulan Ini</button>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              aria-label="Cari laporan pemasangan"
              placeholder="Cari barang, pemasang, lokasi, atau no. dokumen..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-slate-500">Foto berdasarkan bulan unggah (WIB). Tugas menunggu foto berdasarkan bulan dibuat.</p>
          <div className="flex flex-wrap gap-2">
            <label htmlFor="report-source" className="sr-only">Sumber</label>
            <select
              id="report-source"
              value={source}
              onChange={(e) => { setSource(e.target.value); setPage(1); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
            >
              {SOURCE_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
            </select>
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => { setStatus(filter.value); setPage(1); }}
                aria-pressed={status === filter.value}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  status === filter.value
                    ? 'bg-maroon-800 text-white border-maroon-800'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!isLoading && !error && summary.total > 0 && (
        <p className="text-xs text-slate-500">
          {monthLabel}: {summary.total} pemasangan · {summary.completedCount} selesai · {summary.pendingCount} menunggu foto
        </p>
      )}

      {/* Daftar tugas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">Memuat laporan...</div>
        ) : error ? (
          <div role="alert" className="col-span-full rounded-xl border border-rose-200 bg-white p-8 text-center text-xs text-rose-700">
            <p>{error}</p>
            <button type="button" onClick={() => { setLoading(true); setRetry((value) => value + 1); }} className="action-button action-neutral mt-3">Coba Lagi</button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
            Belum ada laporan pemasangan untuk {monthLabel}{status !== 'all' || search ? ' yang cocok dengan filter' : ''}.
            <br />
            Pilih bulan lain untuk melihat arsip laporan sebelumnya.
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden flex flex-col">
              {task.photos.length > 0 ? (
                <div className="relative">
                  <PhotoSlider
                    photos={task.photos}
                    width={480}
                    alt={`Bukti pemasangan ${task.productName} di ${task.location}`}
                    onSlideClick={(index) => { setPreview(task); setPreviewIndex(index); }}
                  />
                  {task.photos.length < task.photoSlots && (
                    <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Menunggu {task.photoSlots - task.photos.length} foto lagi
                    </span>
                  )}
                </div>
              ) : (
                <div className="aspect-[4/3] bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <ImageOff className="w-6 h-6" />
                  <span className="text-[11px]">Foto belum dikirim</span>
                </div>
              )}

              <div className="p-4 space-y-2 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 truncate">{task.productName}</h3>
                    <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      {task.source === 'WEB' ? (
                        <span className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                          <Globe className="h-3 w-3" aria-hidden="true" /> Web
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                          <Send className="h-3 w-3" aria-hidden="true" /> Telegram
                        </span>
                      )}
                      <span className="font-mono">{task.reference ?? task.sku}</span>
                    </p>
                  </div>
                  {task.status === 'COMPLETED' ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Selesai
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                      <Hourglass className="w-3 h-3" /> Menunggu foto
                    </span>
                  )}
                </div>

                <p className="text-xs font-semibold text-slate-800">
                  {task.quantityLabel}
                </p>
                <div className="space-y-1 text-xs text-slate-600">
                  <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-400" /> {task.assigneeName}</p>
                  <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {task.location}</p>
                  <p className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {task.status === 'COMPLETED' ? `Selesai ${formatDate(task.completedAt)}` : `Dibuat ${formatDate(task.createdAt)}`}
                  </p>
                </div>
                {task.notes && <p className="text-[11px] text-slate-500 italic">"{task.notes}"</p>}
                {task.source === 'WEB' && task.status === 'PENDING' && (
                  <Link href="/distribution-reports/listrik" className="inline-block text-[11px] font-semibold text-maroon-800 underline">
                    Kirim ulang link foto di Laporan Peralatan Listrik
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {!isLoading && !error && summary.totalPages > 1 && (
        <nav aria-label="Halaman laporan pemasangan" className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <p>Halaman {page} dari {summary.totalPages} · {summary.total} tugas</p>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="action-button action-neutral"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Sebelumnya</button>
            <button type="button" disabled={page >= summary.totalPages} onClick={() => setPage((value) => value + 1)} className="action-button action-neutral">Berikutnya <ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        </nav>
      )}

      {/* Foto ukuran penuh */}
      {!isLoading && preview && preview.photos.length > 0 && (
        <ModalOverlay
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-10 right-0 text-white/80 hover:text-white flex items-center gap-1 text-xs"
            >
              <X className="w-4 h-4" /> Tutup
            </button>
            <PhotoSlider
              key={preview.id}
              photos={preview.photos}
              width={960}
              fit="object-contain"
              className="h-[70vh] rounded-xl bg-black"
              alt={`Bukti pemasangan ${preview.productName} di ${preview.location}`}
              startIndex={previewIndex}
              onIndexChange={setPreviewIndex}
            />
            <a href={preview.photos[Math.min(previewIndex, preview.photos.length - 1)].url} target="_blank" rel="noopener" className="mt-2 block text-center text-[11px] text-white/70 underline">
              Buka ukuran asli
            </a>
            <p className="text-center text-white text-xs mt-3">
              {preview.productName} ({preview.quantityLabel}) · {preview.assigneeName} · {preview.location} ·{' '}
              {formatDate(preview.completedAt)}
            </p>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
