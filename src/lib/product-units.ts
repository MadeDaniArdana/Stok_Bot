export const DEFAULT_PRODUCT_UNITS = [
  'pcs', 'box', 'rim', 'unit', 'roll', 'meter', 'jerigen', 'liter',
  'botol', 'dus', 'drigen', 'kaleng', 'pack', 'ball', 'kotak', 'lusin', 'kg', 'gram', 'ml',
  // Satuan yang menyertakan ukuran isi, agar jelas per satuannya (mis. Sunlight 330ml, SOS Carbol 800gr).
  'botol 330ml', 'botol 800gr', 'pouch',
];

/**
 * Rapikan satuan: huruf kecil, spasi tunggal, dan ukuran isi dirapatkan
 * ("Botol 330 ML" -> "botol 330ml", "botol 800 gr" -> "botol 800gr").
 */
export function normalizeProductUnit(unit: string) {
  return unit
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('id-ID')
    .replace(/(\d+(?:[.,]\d+)?)\s+(ml|l|liter|gr|g|gram|kg|cc|oz)(?![a-z])/g, '$1$2');
}

export function getProductUnitOptions(units: string[]) {
  return Array.from(new Set([...DEFAULT_PRODUCT_UNITS, ...units].map(normalizeProductUnit).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'id'));
}

export interface PackInfo {
  unit: string;
  packUnit?: string | null;
  packSize?: number | null;
}

/** Jumlah dalam satuan input (satuan dasar atau kemasan) menjadi satuan dasar; null jika bukan bilangan bulat > 0. */
export function toBaseQuantity(product: PackInfo, quantity: number, inputUnit: string): number | null {
  const factor = product.packUnit && product.packSize && inputUnit === product.packUnit ? product.packSize : 1;
  const base = Math.round(quantity * factor * 1e6) / 1e6;
  return Number.isSafeInteger(base) && base > 0 ? base : null;
}

/** Tampilan stok: "7 krat 5 pcs" untuk barang berkemasan, "12 pcs" untuk barang biasa. */
export function formatStock(product: PackInfo, quantity: number): string {
  if (quantity < 0) return `-${formatStock(product, -quantity)}`;
  if (!product.packUnit || !product.packSize) return `${quantity} ${product.unit}`;
  const packs = Math.floor(quantity / product.packSize);
  const rest = quantity % product.packSize;
  const parts = [];
  if (packs > 0) parts.push(`${packs} ${product.packUnit}`);
  if (rest > 0 || packs === 0) parts.push(`${rest} ${product.unit}`);
  return parts.join(' ');
}

/**
 * Jumlah pada baris dokumen (distribusi/tugas) yang menyimpan satuan saat dibuat.
 * Jika satuannya masih satuan dasar barang, tampil gabungan kemasan + satuan dasar (mis. "1 liter 500 ml").
 */
export function formatItemQuantity(quantity: number, itemUnit: string, product?: Partial<PackInfo> | null): string {
  if (product?.unit && product.unit === itemUnit) {
    return formatStock({ unit: product.unit, packUnit: product.packUnit, packSize: product.packSize }, quantity);
  }
  return `${quantity} ${itemUnit}`;
}

/** Field Prisma untuk select produk agar tampilan stok bisa digabung (kemasan + satuan dasar). */
export const PACK_SELECT = { unit: true, packUnit: true, packSize: true } as const;
