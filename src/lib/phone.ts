/**
 * Ubah nomor HP Indonesia ke format internasional tanpa "+" untuk link wa.me.
 * Menerima "0812-3456-7890", "+62 812 3456 7890", "62812...", atau "812...".
 * Mengembalikan null jika kosong, dan melempar error jika formatnya tidak masuk akal.
 */
export function normalizeWhatsAppNumber(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  if (!/^[+\d\s().-]+$/.test(raw)) throw new Error('No. WhatsApp hanya boleh berisi angka.');

  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;

  if (!/^62\d{8,13}$/.test(digits)) {
    throw new Error('No. WhatsApp tidak valid. Contoh: 081234567890.');
  }
  return digits;
}

/** Tampilan yang mudah dibaca: 6281234567890 -> 0812-3456-7890 */
export function formatPhoneForDisplay(international: string) {
  const local = international.startsWith('62') ? `0${international.slice(2)}` : international;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
}
