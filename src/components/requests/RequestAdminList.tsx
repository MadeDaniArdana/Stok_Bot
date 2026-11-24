'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, X, LoaderCircle } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, ItemsList, StatusBadge, type RequestRow } from './shared';

/** Daftar pengajuan untuk admin: "incoming" (bisa disetujui/ditolak) atau "history". */
export function RequestAdminList({ view }: { view: 'incoming' | 'history' }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/requests?view=${view}`, { cache: 'no-store' });
    if (res.ok) setRows(await res.json());
  }, [view]);

  useEffect(() => {
    load();
    // Pop-up pengingat memberi sinyal ini saat ada pengajuan baru masuk.
    window.addEventListener('requests-changed', load);
    return () => window.removeEventListener('requests-changed', load);
  }, [load]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memproses pengajuan.');
      showToast(
        action === 'approve' ? 'Pengajuan Disetujui' : 'Pengajuan Ditolak',
        action === 'approve' ? `Stok dikurangi dan tercatat di Distribusi ${data.request.distributionNumber}.` : undefined
      );
      setRejectingId(null);
      setReason('');
      await load();
    } catch (err: any) {
      showToast('Gagal', err.message, 'error');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{view === 'incoming' ? 'Pengajuan Masuk' : 'Riwayat Pengajuan'}</h1>
        <p className="text-xs text-slate-500">
          {view === 'incoming'
            ? 'Pengajuan barang dari divisi. Jika disetujui, stok langsung berkurang dan tercatat di Distribusi.'
            : 'Pengajuan yang sudah disetujui atau ditolak.'}
        </p>
      </div>

      {rows === null ? (
        <p className="py-10 text-center text-sm text-slate-400">Memuat...</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
          {view === 'incoming' ? 'Tidak ada pengajuan yang menunggu.' : 'Belum ada riwayat pengajuan.'}
        </p>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs font-bold text-maroon-800">{r.number}</p>
                <p className="text-sm font-semibold text-slate-900">{r.divisionName}</p>
                <p className="text-[11px] text-slate-500">
                  {r.stockGroup === 'ATK' ? 'ATK' : 'Logistik'} • diajukan {formatDateTime(r.createdAt)}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>

            <ItemsList items={r.items} />
            {r.notes && <p className="text-xs text-slate-600">Catatan: {r.notes}</p>}

            {view === 'history' && (
              <p className="text-xs text-slate-500">
                {r.status === 'APPROVED'
                  ? `Disetujui ${r.decidedByName ?? ''} • ${r.decidedAt ? formatDateTime(r.decidedAt) : ''} • Distribusi ${r.distributionNumber ?? '-'}`
                  : `Ditolak ${r.decidedByName ?? ''} • ${r.decidedAt ? formatDateTime(r.decidedAt) : ''} • Alasan: ${r.rejectReason ?? '-'}`}
              </p>
            )}

            {view === 'incoming' &&
              (rejectingId === r.id ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={300}
                    placeholder="Alasan penolakan (wajib)"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-maroon-700 focus:outline-none focus:ring-2 focus:ring-maroon-500/20"
                  />
                  <button
                    onClick={() => act(r.id, 'reject')}
                    disabled={busyId === r.id || !reason.trim()}
                    className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Kirim Penolakan
                  </button>
                  <button onClick={() => { setRejectingId(null); setReason(''); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                    Batal
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => act(r.id, 'approve')}
                    disabled={busyId === r.id || r.status === 'PROCESSING'}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busyId === r.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Setujui
                  </button>
                  <button
                    onClick={() => setRejectingId(r.id)}
                    disabled={busyId === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" /> Tolak
                  </button>
                </div>
              ))}
          </div>
        ))
      )}
    </div>
  );
}
