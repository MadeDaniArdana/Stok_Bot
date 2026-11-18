/**
 * Nama pelaku/pembuat untuk ditampilkan di riwayat dan laporan.
 * Selama akunnya ada, pakai nama akun terbaru. Setelah akun dihapus, pakai nama yang
 * disalin saat penghapusan, diberi keterangan "(akun dihapus)".
 */
export function personName(liveName: string | null | undefined, savedName: string | null | undefined, fallback = '-') {
  if (liveName) return liveName;
  if (savedName) return `${savedName} (akun dihapus)`;
  return fallback;
}
