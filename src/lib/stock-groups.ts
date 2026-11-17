/**
 * Tiga jenis stok StockFlow. Setiap kategori memiliki satu jenis stok, dan barang
 * mengikuti jenis kategorinya. Label form mengikuti formulir kertas yang dipakai bagian umum.
 */
export type StockGroup = 'LISTRIK' | 'LOGISTIK' | 'ATK';

export interface StockGroupConfig {
  id: StockGroup;
  /** Nilai di URL, contoh ?jenis=listrik */
  slug: string;
  label: string;
  shortLabel: string;
  description: string;
  /** Judul formulir cetak */
  formTitle: string;
  /** Kode dokumen di pojok kanan atas formulir cetak (kosong = tidak ditampilkan) */
  documentCode?: string;
  documentRevision?: string;
  /** Label kolom tujuan: "Kepada" untuk unit, "Ruang" untuk peralatan listrik */
  recipientLabel: string;
  recipientPlaceholder: string;
  /** Label orang yang menyerahkan / memasang */
  handoverLabel: string;
  /** Prefix nomor dokumen */
  numberPrefix: string;
  /** Kelas warna Tailwind untuk badge/tab */
  badgeClass: string;
}

export const STOCK_GROUPS: StockGroupConfig[] = [
  {
    id: 'LISTRIK',
    slug: 'listrik',
    label: 'Peralatan Listrik',
    shortLabel: 'Listrik',
    description: 'Lampu, kabel, stop kontak, dan perlengkapan instalasi listrik.',
    formTitle: 'Form Distribusi Peralatan Listrik',
    recipientLabel: 'Ruang',
    recipientPlaceholder: 'Contoh: Perpustakaan, Lorong Gd. A, Toilet Lt. 3',
    handoverLabel: 'Nama Petugas',
    numberPrefix: 'LST',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    id: 'LOGISTIK',
    slug: 'logistik',
    label: 'Logistik',
    shortLabel: 'Logistik',
    description: 'Logistik satpam, perlengkapan petugas kebersihan, dan konsumsi.',
    formTitle: 'Form Distribusi Barang Logistik',
    documentCode: 'F-RUT-0204',
    documentRevision: '3',
    recipientLabel: 'Kepada',
    recipientPlaceholder: 'Contoh: Satpam Pos Utama, Petugas Kebersihan Gd. B',
    handoverLabel: 'Yang Menyerahkan',
    numberPrefix: 'LOG',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  {
    id: 'ATK',
    slug: 'atk',
    label: 'ATK',
    shortLabel: 'ATK',
    description: 'Alat tulis kantor, kertas, map, tinta, dan perlengkapan administrasi.',
    formTitle: 'Form Distribusi Barang',
    documentCode: 'F-RUT-0204',
    documentRevision: '3',
    recipientLabel: 'Kepada',
    recipientPlaceholder: 'Contoh: Tata Usaha BAAK FTIK',
    handoverLabel: 'Yang Menyerahkan',
    numberPrefix: 'ATK',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
  },
];

export const DEFAULT_STOCK_GROUP: StockGroup = 'ATK';

export function isStockGroup(value: unknown): value is StockGroup {
  return value === 'LISTRIK' || value === 'LOGISTIK' || value === 'ATK';
}

export function getStockGroup(id: string | null | undefined): StockGroupConfig {
  return STOCK_GROUPS.find((group) => group.id === id) ?? STOCK_GROUPS.find((group) => group.id === DEFAULT_STOCK_GROUP)!;
}

/** Terima slug (listrik) atau id (LISTRIK); null bila tidak dikenal. */
export function parseStockGroup(value: string | null | undefined): StockGroup | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return isStockGroup(normalized) ? normalized : null;
}
