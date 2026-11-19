import type { StockGroup } from '@/lib/stock-groups';

export interface DistributionProductOption {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  unit: string;
  packUnit?: string | null;
  packSize?: number | null;
}

export interface DistributionTemplateOption {
  id: string;
  name: string;
  recipientUnit: string;
  storageLocation: string | null;
  receiverName: string | null;
  items: { productId: string; quantity: number; product: { isActive: boolean } }[];
}

export interface DistributionBootstrapData {
  products: DistributionProductOption[];
  templates: DistributionTemplateOption[];
  recipients: string[];
  handoverNames: string[];
  receiverNames: string[];
  fetchedAt: number;
}

const cache = new Map<StockGroup, DistributionBootstrapData>();
const inflight = new Map<StockGroup, Promise<DistributionBootstrapData>>();

export function getCachedDistributionBootstrap(groupId: StockGroup): DistributionBootstrapData | undefined {
  return cache.get(groupId);
}

export function patchCachedDistributionBootstrap(
  groupId: StockGroup,
  updater: (current: DistributionBootstrapData) => DistributionBootstrapData
) {
  const existing = cache.get(groupId);
  if (!existing) return;
  cache.set(groupId, updater(existing));
}

export function fetchDistributionBootstrap(groupId: StockGroup): Promise<DistributionBootstrapData> {
  const running = inflight.get(groupId);
  if (running) return running;

  const promise = fetch(`/api/distributions/bootstrap?jenis=${groupId}`)
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Gagal memuat data distribusi'))))
    .then((data) => {
      const entry: DistributionBootstrapData = {
        products: data.products || [],
        templates: data.templates || [],
        recipients: data.recipients || [],
        handoverNames: data.handoverNames || [],
        receiverNames: data.receiverNames || [],
        fetchedAt: Date.now(),
      };
      cache.set(groupId, entry);
      return entry;
    })
    .finally(() => {
      inflight.delete(groupId);
    });

  inflight.set(groupId, promise);
  return promise;
}

/** Muat data jenis stok di latar belakang bila belum ada di cache atau sudah lebih dari maxAgeMs. */
export function prefetchDistributionBootstrap(groupId: StockGroup, maxAgeMs = 30_000) {
  const existing = cache.get(groupId);
  if (existing && Date.now() - existing.fetchedAt < maxAgeMs) return;
  fetchDistributionBootstrap(groupId).catch(() => undefined);
}

