/**
 * Cache SWR ringan di memori browser (tanpa dependensi eksternal) dengan deduplikasi in-flight.
 * Digunakan agar perpindahan antar menu (Dashboard, Ringkasan, Master Barang, Laporan Distribusi)
 * tampil instan dari cache sambil memperbarui data secara diam-diam di latar belakang.
 */

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const MAX_CACHE_ENTRIES = 80;
const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function getSwrCache<T>(key: string): T | undefined {
  return cache.get(key)?.data as T | undefined;
}

export function setSwrCache<T>(key: string, data: T): void {
  if (!cache.has(key) && cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { data, fetchedAt: Date.now() });
}

export function invalidateSwrPrefix(prefix: string): void {
  cache.forEach((_entry, key) => {
    if (key.startsWith(prefix)) cache.delete(key);
  });
}

export function clearSwrCache(): void {
  cache.clear();
  inflight.clear();
}

export function fetchSwrJson<T>(url: string, options?: { force?: boolean; signal?: AbortSignal }): Promise<T> {
  if (!options?.force) {
    const running = inflight.get(url) as Promise<T> | undefined;
    if (running) return running;
  }

  const promise = fetch(url, { signal: options?.signal })
    .then(async (res) => {
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error((json && typeof json.error === 'string' && json.error) || `Gagal memuat ${url}`);
      }
      setSwrCache(url, json);
      return json as T;
    })
    .finally(() => {
      if (inflight.get(url) === promise) inflight.delete(url);
    });

  if (!options?.signal) {
    inflight.set(url, promise);
  }
  return promise;
}

/** Hangatkan cache di latar belakang bila belum ada atau sudah melewati maxAgeMs. */
export function prefetchSwrJson(url: string, maxAgeMs = 30_000): void {
  const existing = cache.get(url);
  if (existing && Date.now() - existing.fetchedAt < maxAgeMs) return;
  fetchSwrJson(url).catch(() => undefined);
}
