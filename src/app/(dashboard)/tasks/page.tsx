'use client';

import React, { useEffect, useState } from 'react';
import { Camera, Search, MapPin, User, Clock, CheckCircle2, Hourglass, X, ImageOff } from 'lucide-react';

interface TaskItem {
  id: string;
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
}

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
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<TaskItem | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const query = new URLSearchParams({ status, search }).toString();
        const res = await fetch(`/api/tasks?${query}`, { signal: controller.signal });
        const data = await res.json();
        setTasks(res.ok ? data.items || [] : []);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setTasks([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [status, search]);

  const completedCount = tasks.filter((task) => task.status === 'COMPLETED').length;
  const pendingCount = tasks.length - completedCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Laporan Pemasangan</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Tugas pemasangan dari Telegram beserta foto bukti yang dikirim pemasang
        </p>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-soft flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari barang, pemasang, atau lokasi..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatus(filter.value)}
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

      {!loading && tasks.length > 0 && (
        <p className="text-xs text-slate-500">
          {tasks.length} tugas · {completedCount} selesai · {pendingCount} menunggu foto
        </p>
      )}

      {/* Daftar tugas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">Memuat laporan...</div>
        ) : tasks.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
            Belum ada tugas pemasangan{status !== 'all' || search ? ' yang cocok dengan filter' : ''}.
            <br />
            Tugas dibuat admin melalui bot Telegram.
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="bg-white rounded-xl border border-slate-200 shadow-soft overflow-hidden flex flex-col">
              {task.photoUrl ? (
                <button
                  onClick={() => setPreview(task)}
                  className="block aspect-[4/3] bg-slate-100 overflow-hidden group"
                  aria-label={`Lihat foto bukti ${task.productName}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={task.photoUrl}
                    alt={`Bukti pemasangan ${task.productName} di ${task.location}`}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </button>
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
                    <p className="text-[11px] text-slate-500 font-mono">{task.sku}</p>
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
                  {task.quantity} {task.unit}
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
              </div>
            </div>
          ))
        )}
      </div>

      {/* Foto ukuran penuh */}
      {preview?.photoUrl && (
        <div
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.photoUrl}
              alt={`Bukti pemasangan ${preview.productName} di ${preview.location}`}
              className="w-full max-h-[75vh] object-contain rounded-xl bg-black"
            />
            <p className="text-center text-white text-xs mt-3">
              {preview.productName} ({preview.quantity} {preview.unit}) · {preview.assigneeName} · {preview.location} ·{' '}
              {formatDate(preview.completedAt)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
