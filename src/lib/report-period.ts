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
