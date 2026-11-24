'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, X } from 'lucide-react';

const POLL_MS = 20_000;
const SEEN_KEY = 'stockflow:requests-seen';

interface Pending {
  count: number;
  latest: { id: string; number: string; divisionName: string; itemCount: number }[];
}

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

/**
 * Pop-up dari sisi kanan yang mengingatkan admin bila ada pengajuan barang menunggu.
 * Muncul lagi hanya untuk pengajuan yang belum pernah ditutup/dilihat (disimpan per tab).
 */
export function RequestAlert() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [visible, setVisible] = useState(false);
  const knownIds = useRef<string>('');

  const check = useCallback(async () => {
    if (document.hidden) return;
    try {
      const res = await fetch('/api/requests/pending', { cache: 'no-store' });
      if (!res.ok) return;
      const data: Pending = await res.json();
      const ids = data.latest.map((r) => r.id).join(',');
      // Daftar berubah: beri tahu halaman Pengajuan Masuk agar memuat ulang daftarnya.
      if (knownIds.current && ids !== knownIds.current) window.dispatchEvent(new Event('requests-changed'));
      knownIds.current = ids;
      setPending(data);
      const seen = readSeen();
      setVisible(data.latest.some((r) => !seen.has(r.id)));
    } catch {
      // Jaringan putus sesaat: coba lagi pada polling berikutnya.
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, POLL_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [check]);

  const dismiss = () => {
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify(pending?.latest.map((r) => r.id) ?? []));
    } catch {}
    setVisible(false);
  };

  // Efek meluncur dari samping: mulai di luar layar lalu masuk setelah render pertama.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!visible) return setShown(false);
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  if (!visible || !pending) return null;
  const first = pending.latest[0];

  return (
    <div
      role="alert"
      className={`fixed right-0 top-20 z-50 w-full max-w-sm px-4 transition-transform duration-500 ease-out sm:px-0 sm:pr-4 ${shown ? 'translate-x-0' : 'translate-x-[110%]'}`}
    >
      <div className="flex items-start gap-3 rounded-xl border border-maroon-200 border-l-4 border-l-maroon-700 bg-white p-4 shadow-lg">
        <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-maroon-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {pending.count} pengajuan barang menunggu
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-600">
            Terbaru dari {first.divisionName} ({first.itemCount} barang)
          </p>
          <Link
            href="/requests/incoming"
            onClick={dismiss}
            className="mt-2 inline-block rounded-lg bg-maroon-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-maroon-900"
          >
            Lihat Pengajuan
          </Link>
        </div>
        <button onClick={dismiss} aria-label="Tutup" className="text-slate-400 hover:text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
