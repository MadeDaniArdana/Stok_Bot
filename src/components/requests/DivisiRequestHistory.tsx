'use client';

import React, { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { formatDateTime, ItemsList, StatusBadge, type RequestRow } from './shared';

const FILTERS = [
  { key: 'ALL', label: 'Semua' },
  { key: 'PENDING', label: 'Menunggu' },
  { key: 'APPROVED', label: 'Disetujui' },
  { key: 'REJECTED', label: 'Ditolak' },
] as const;

export function DivisiRequestCard({ r }: { r: RequestRow }) {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs font-bold text-maroon-800">{r.number}</p>
          <p className="text-[11px] text-slate-500">
            {r.stockGroup === 'ATK' ? 'ATK' : 'Logistik'} • {formatDateTime(r.createdAt)}
          </p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <ItemsList items={r.items} />
      {r.notes && <p className="text-xs text-slate-600">Catatan: {r.notes}</p>}
      {r.status === 'REJECTED' && <p className="text-xs text-rose-700">Alasan ditolak: {r.rejectReason}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-xs text-emerald-700">
          {r.status === 'APPROVED'
            ? `Disetujui${r.distributionNumber ? `, barang diserahkan (Distribusi ${r.distributionNumber})` : ''}.`
            : ''}
        </p>
        <a
          href={`/print/request/${r.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <Printer className="h-3.5 w-3.5" /> Cetak Pengajuan
        </a>
      </div>
    </div>
  );
}

export function DivisiRequestHistory() {
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('ALL');

  useEffect(() => {
    fetch('/api/divisi/requests', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows);
  }, []);

  const shown = (rows ?? []).filter((r) => filter === 'ALL' || (filter === 'PENDING' ? r.status === 'PENDING' || r.status === 'PROCESSING' : r.status === filter));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${filter === f.key ? 'border-maroon-700 bg-maroon-50 text-maroon-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {rows === null ? (
        <p className="py-10 text-center text-sm text-slate-400">Memuat...</p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">Belum ada pengajuan.</p>
      ) : (
        shown.map((r) => <DivisiRequestCard key={r.id} r={r} />)
      )}
    </div>
  );
}
