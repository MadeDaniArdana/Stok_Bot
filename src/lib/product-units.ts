export const DEFAULT_PRODUCT_UNITS = ['pcs', 'box', 'rim', 'unit', 'roll', 'meter', 'jerigen', 'liter'];

export function normalizeProductUnit(unit: string) {
  return unit.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
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
  if (!product.packUnit || !product.packSize) return `${quantity} ${product.unit}`;
  const packs = Math.floor(quantity / product.packSize);
  const rest = quantity % product.packSize;
  const parts = [];
  if (packs > 0) parts.push(`${packs} ${product.packUnit}`);
  if (rest > 0 || packs === 0) parts.push(`${rest} ${product.unit}`);
  return parts.join(' ');
}
