export const DIVISION_OPTIONS = [
  'Keuangan',
  'Tata Usaha Kemahasiswaan',
  'TU Warek',
  'FTIK',
  'FSIP',
  'FEB',
  'LPPM',
  'LPBM',
  'Perpustakaan',
  'Informasi',
  'TU SI',
  'TU IF',
];

export function normalizeDivisionName(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}
