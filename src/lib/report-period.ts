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

/** Batas saldo awal khusus untuk bulan yang memuat waktu konfigurasi server. */
export function getStockOpeningBalance(month: string) {
  const value = process.env.STOCK_OPENING_BALANCE_AT?.trim();
  if (!value) return null;

  const match = /^([1-9]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d)\+07:00$/.exec(value);
  const date = new Date(value);
  if (!match || !Number.isFinite(date.getTime()) ||
      new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 19) !== match[1]) {
    throw new Error('STOCK_OPENING_BALANCE_AT harus dalam format YYYY-MM-DDTHH:mm:ss+07:00.');
  }
  if (!value.startsWith(`${month}-`)) return null;

  const [year, monthNumber, day] = value.slice(0, 10).split('-').map(Number);
  const time = value.slice(11, 19).replace(/:00$/, '').replace(/:/g, '.');
  return { date, label: `${day} ${MONTH_NAMES_ID[monthNumber - 1]} ${year} pukul ${time} WIB` };
}

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
  const openingBalance = getStockOpeningBalance(month);
  return {
    kind: 'month',
    value: month,
    ...range,
    label: `${MONTH_NAMES_ID[monthNumber - 1]} ${year}`,
    openingLabel: openingBalance ? `per ${openingBalance.label}` : `per 1 ${MONTH_NAMES_ID[monthNumber - 1]} ${year}`,
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
