'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardList, Clock, Plus, XCircle } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { useAuth } from '@/components/layout/AuthContext';
import { DivisiRequestCard } from './DivisiRequestHistory';
import type { RequestRow } from './shared';

export function DivisiDashboard() {
  const { currentUser } = useAuth();
  const [rows, setRows] = useState<RequestRow[] | null>(null);

  useEffect(() => {
    fetch('/api/divisi/requests', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows);
  }, []);

  const count = (...s: RequestRow['status'][]) => (rows ?? []).filter((r) => s.includes(r.status)).length;
  const value = (n: number) => (rows === null ? '...' : n);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard {currentUser?.name ?? ''}</h1>
          <p className="text-xs text-slate-500">Ringkasan pengajuan barang divisi Anda.</p>
        </div>
        <Link href="/divisi/pengajuan" className="inline-flex items-center justify-center gap-2 rounded-xl bg-maroon-800 px-5 py-2.5 text-xs font-semibold text-white hover:bg-maroon-900">
          <Plus className="h-4 w-4" /> Buat Pengajuan
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard title="Total Pengajuan" value={value((rows ?? []).length)} icon={ClipboardList} variant="maroon" />
        <KPICard title="Menunggu" value={value(count('PENDING', 'PROCESSING'))} subtitle="Belum diputuskan admin" icon={Clock} variant="warning" />
        <KPICard title="Disetujui" value={value(count('APPROVED'))} icon={CheckCircle2} variant="success" />
        <KPICard title="Ditolak" value={value(count('REJECTED'))} icon={XCircle} variant="danger" />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-900">Pengajuan Terbaru</h2>
          <Link href="/divisi/riwayat" className="text-xs font-semibold text-maroon-800 hover:underline">Lihat semua</Link>
        </div>
        {rows === null ? (
          <p className="py-6 text-center text-sm text-slate-400">Memuat...</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">Belum ada pengajuan. Klik "Buat Pengajuan" untuk memulai.</p>
        ) : (
          rows.slice(0, 5).map((r) => <DivisiRequestCard key={r.id} r={r} />)
        )}
      </section>
    </div>
  );
}
