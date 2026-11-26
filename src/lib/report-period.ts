/** Bulan kalender laporan menggunakan WIB, terlepas dari zona waktu browser/server. */
export function getCurrentReportMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}`;
}

export function getReportMonthRange(month: string) {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Bulan laporan harus dalam format YYYY-MM.');
  }
  const [year, monthNumber] = month.split('-').map(Number);
  const offset = 7 * 60 * 60 * 1000;
  return {
    gte: new Date(Date.UTC(year, monthNumber - 1, 1) - offset),
    lt: new Date(Date.UTC(year, monthNumber, 1) - offset),
  };
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export interface StockReportPeriod {
  kind: 'month' | 'year';
  /** Nilai asli periode: YYYY-MM (bulanan) atau YYYY (tahunan). */
  value: string;
  gte: Date;
  lt: Date;
  /** Contoh: "November 2026" atau "Tahun 2026". */
  label: string;
  /** Label stok lama, contoh: "Stok Awal (per 1 November 2026)". */
  openingLabel: string;
}

/**
 * Periode laporan posisi stok: "YYYY-MM" untuk bulanan atau "YYYY" untuk tahunan (WIB).
 * Nilai kosong/tidak valid jatuh ke bulan berjalan.
 */
export function parseStockReportPeriod(raw: string | null | undefined, now = new Date()): StockReportPeriod {
  const value = (raw || '').trim();
  const offset = 7 * 60 * 60 * 1000;
  if (/^[1-9]\d{3}$/.test(value)) {
    const year = Number(value);
    return {
      kind: 'year',
      value,
      gte: new Date(Date.UTC(year, 0, 1) - offset),
      lt: new Date(Date.UTC(year + 1, 0, 1) - offset),
      label: `Tahun ${year}`,
      openingLabel: `per 1 Januari ${year}`,
    };
  }
  const month = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value) ? value : getCurrentReportMonth(now);
  const [year, monthNumber] = month.split('-').map(Number);
  const range = getReportMonthRange(month);
  return {
    kind: 'month',
    value: month,
    ...range,
    label: `${MONTH_NAMES_ID[monthNumber - 1]} ${year}`,
    openingLabel: `per 1 ${MONTH_NAMES_ID[monthNumber - 1]} ${year}`,
  };
}

/**
 * Periode Ringkasan Persediaan: ?periode=YYYY-MM / YYYY (laporan bulanan/tahunan),
 * atau ?days=N (Dashboard). Tanpa keduanya: bulan berjalan.
 */
export function resolveSummaryPeriod(periode: string | null | undefined, days: string | null | undefined): number | StockReportPeriod {
  if (!periode && days) {
    const rawDays = parseInt(days, 10);
    return Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 365) : 30;
  }
  return parseStockReportPeriod(periode);
}
