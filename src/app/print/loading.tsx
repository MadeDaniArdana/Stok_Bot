import { LoaderCircle } from 'lucide-react';

/** Tampil langsung saat tab cetak dibuka, selama data form/laporan dan PDF disiapkan. */
export default function PrintLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 font-sans text-slate-600" role="status" aria-live="polite">
      <LoaderCircle className="h-10 w-10 animate-spin text-maroon-800" aria-hidden="true" />
      <p className="text-sm font-semibold text-slate-800">Menyiapkan dokumen cetak...</p>
      <p className="text-xs text-slate-500">Setelah tampil, tekan Cetak / Simpan PDF.</p>
    </div>
  );
}
