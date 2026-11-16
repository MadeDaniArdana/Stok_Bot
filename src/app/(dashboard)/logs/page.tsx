'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Globe,
  Monitor,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Bell,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

interface LogItem {
  id: string;
  source: string;
  level: string;
  message: string;
  location: string | null;
  stack: string | null;
  context: string | null;
  resolved: boolean;
  createdAt: string;
}

const SOURCES: Record<string, { label: string; icon: React.ElementType; className: string; hint: string }> = {
  WEB: { label: 'Web/API', icon: Globe, className: 'bg-sky-50 text-sky-700 border-sky-200', hint: 'Error di server saat membuka halaman atau menyimpan data' },
  TELEGRAM: { label: 'Telegram', icon: Send, className: 'bg-indigo-50 text-indigo-700 border-indigo-200', hint: 'Error saat bot memproses pesan atau mengirim balasan' },
  UPLOAD: { label: 'Upload foto', icon: Upload, className: 'bg-emerald-50 text-emerald-700 border-emerald-200', hint: 'Pemasang gagal membuka link atau mengirim foto bukti' },
  NOTIFICATION: { label: 'Notifikasi', icon: Bell, className: 'bg-amber-50 text-amber-700 border-amber-200', hint: 'Pesan stok menipis / tugas selesai gagal terkirim' },
  AI: { label: 'Asisten AI', icon: Sparkles, className: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', hint: 'Server AI tidak bisa dihubungi atau menolak permintaan' },
  BROWSER: { label: 'Browser', icon: Monitor, className: 'bg-slate-100 text-slate-700 border-slate-200', hint: 'Error JavaScript di browser pengguna' },
};

function formatTime(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function prettyContext(raw: string | null) {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default function ErrorLogPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<LogItem[]>([]);
  const [summary, setSummary] = useState<{ open: Record<string, number>; last24h: number }>({ open: {}, last24h: 0 });
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('open');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({ status, ...(source ? { source } : {}), ...(search ? { search } : {}) });
      const res = await fetch(`/api/logs?${query}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.items);
      setSummary(data.summary);
    } catch (error) {
      showToast('Gagal memuat log', error instanceof Error ? error.message : 'Terjadi kesalahan', 'error');
    } finally {
      setLoading(false);
    }
  }, [source, status, search, showToast]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const setResolved = async (id: string, resolved: boolean) => {
    const res = await fetch('/api/logs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, resolved }),
    });
    if (res.ok) load();
  };

  const resolveAll = async () => {
    if (!confirm('Tandai semua error yang terbuka sebagai selesai?')) return;
    const res = await fetch('/api/logs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    const data = await res.json();
    if (res.ok) showToast('Selesai', `${data.count} error ditandai selesai.`);
    load();
  };

  const deleteResolved = async () => {
    if (!confirm('Hapus permanen semua log yang sudah ditandai selesai?')) return;
    const res = await fetch('/api/logs', { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) showToast('Dihapus', `${data.count} log dihapus.`);
    load();
  };

  const totalOpen = Object.values(summary.open).reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Bug className="w-6 h-6 text-maroon-800" /> Log Error
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Catatan error dari web, bot Telegram, upload foto, notifikasi, asisten AI, dan browser. Log lebih dari 60 hari dihapus otomatis.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold shadow-soft"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
        </button>
      </div>

      {/* Ringkasan per sumber */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(SOURCES).map(([key, meta]) => {
          const Icon = meta.icon;
          const count = summary.open[key] || 0;
          const active = source === key;
          return (
            <button
              key={key}
              onClick={() => setSource(active ? '' : key)}
              title={meta.hint}
              className={`text-left bg-white rounded-xl p-3 border shadow-soft transition-all ${
                active ? 'border-maroon-700 ring-2 ring-maroon-500/20' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <Icon className="w-3.5 h-3.5" /> {meta.label}
              </div>
              <p className={`text-xl font-extrabold mt-1 ${count ? 'text-rose-600' : 'text-slate-300'}`}>{count}</p>
              <p className="text-[10px] text-slate-400">belum selesai</p>
            </button>
          );
        })}
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-soft flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pesan, lokasi, ID Telegram, nama barang..."
            aria-label="Cari log"
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-maroon-500/20 focus:border-maroon-700"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { value: 'open', label: `Belum selesai (${totalOpen})` },
            { value: 'resolved', label: 'Selesai' },
            { value: 'all', label: 'Semua' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setStatus(option.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                status === option.value ? 'bg-maroon-800 text-white border-maroon-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          ))}
          <span className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />
          <button onClick={resolveAll} disabled={!totalOpen} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40">
            Tandai semua selesai
          </button>
          <button onClick={deleteResolved} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" /> Hapus yang selesai
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">{summary.last24h} error tercatat dalam 24 jam terakhir.</p>

      {/* Daftar log */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-soft divide-y divide-slate-100">
        {loading && items.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-400">Memuat log...</p>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-700 mt-2">Tidak ada error</p>
            <p className="text-xs text-slate-400">Belum ada error yang cocok dengan filter ini.</p>
          </div>
        ) : (
          items.map((item) => {
            const meta = SOURCES[item.source] || SOURCES.WEB;
            const Icon = meta.icon;
            const isOpen = expanded === item.id;
            const context = prettyContext(item.context);
            return (
              <div key={item.id} className={item.resolved ? 'opacity-60' : ''}>
                <button
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className="w-full text-left p-4 flex items-start gap-3 hover:bg-slate-50/70"
                  aria-expanded={isOpen}
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.className}`}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                      {item.level === 'WARNING' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3" /> Peringatan
                        </span>
                      )}
                      {item.resolved && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Selesai</span>
                      )}
                      <span className="text-[11px] text-slate-400 font-mono">{formatTime(item.createdAt)}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 mt-1.5 break-words">{item.message}</p>
                    {item.location && <p className="text-[11px] text-slate-500 font-mono mt-0.5 break-all">di {item.location}</p>}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pl-11 space-y-3">
                    {context && (
                      <div>
                        <p className="text-[11px] font-semibold text-slate-600 mb-1">Konteks</p>
                        <pre className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{context}</pre>
                      </div>
                    )}
                    {item.stack && (
                      <div>
                        <p className="text-[11px] font-semibold text-slate-600 mb-1">Detail teknis (stack trace)</p>
                        <pre className="text-[10px] bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto max-h-64">{item.stack}</pre>
                      </div>
                    )}
                    <button
                      onClick={() => setResolved(item.id, !item.resolved)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        item.resolved ? 'text-slate-600 border-slate-200 hover:bg-slate-50' : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> {item.resolved ? 'Buka lagi' : 'Tandai selesai'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
