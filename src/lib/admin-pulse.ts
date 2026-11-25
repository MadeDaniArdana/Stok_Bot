'use client';

/**
 * Poller background tunggal untuk sesi admin (Header + RequestAlert berbagi 1 timer & 1 request
 * ke /api/admin/pulse tiap 30 detik, otomatis jeda saat tab tidak terlihat).
 */
export interface AdminPulseData {
  unreadCount: number;
  pendingRequests: {
    count: number;
    latest: { id: string; number: string; divisionName: string; itemCount: number }[];
  };
}

type Listener = (data: AdminPulseData) => void;

const POLL_MS = 30_000;
const MIN_GAP_MS = 15_000;

const listeners = new Set<Listener>();
let latestData: AdminPulseData | null = null;
let lastFetchedAt = 0;
let inflight: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let visibilityBound = false;

function emit(data: AdminPulseData) {
  latestData = data;
  listeners.forEach((fn) => fn(data));
}

export async function refreshAdminPulse(force = false) {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
  const now = Date.now();
  if (!force && now - lastFetchedAt < MIN_GAP_MS) return;
  if (inflight) return inflight;

  lastFetchedAt = now;
  inflight = fetch('/api/admin/pulse', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) return;
      const data: AdminPulseData = await res.json();
      emit(data);
    })
    .catch(() => {
      // Jaringan putus sesaat: biarkan dicoba ulang pada siklus polling berikutnya.
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Perbarui jumlah belum dibaca lokal tanpa menunggu polling berikutnya (mis. setelah tandai semua dibaca). */
export function patchAdminPulseUnread(unreadCount: number) {
  if (!latestData) return;
  emit({ ...latestData, unreadCount });
}

function handleVisibility() {
  if (document.visibilityState === 'visible') {
    refreshAdminPulse(false);
  }
}

function startPolling() {
  if (!timer) {
    timer = setInterval(() => {
      refreshAdminPulse(true);
    }, POLL_MS);
  }
  if (!visibilityBound && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
    visibilityBound = true;
  }
  refreshAdminPulse(false);
}

function stopPolling() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (visibilityBound && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibility);
    visibilityBound = false;
  }
}

export function subscribeAdminPulse(listener: Listener): () => void {
  listeners.add(listener);
  if (latestData) listener(latestData);
  startPolling();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopPolling();
  };
}
