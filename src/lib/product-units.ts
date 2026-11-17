export const DEFAULT_PRODUCT_UNITS = ['pcs', 'box', 'rim', 'unit', 'roll', 'meter', 'jerigen', 'liter'];

export function normalizeProductUnit(unit: string) {
  return unit.trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID');
}

export function getProductUnitOptions(units: string[]) {
  return Array.from(new Set([...DEFAULT_PRODUCT_UNITS, ...units].map(normalizeProductUnit).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'id'));
}
