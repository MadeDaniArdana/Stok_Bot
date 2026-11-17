'use client';

import { ArrowLeft, Printer } from 'lucide-react';

/** Tombol cetak di atas dokumen; tidak ikut tercetak. */
export function PrintToolbar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 font-sans print:hidden">
      <a href={backHref} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-maroon-800 px-4 py-2 text-xs font-semibold text-white hover:bg-maroon-900"
      >
        <Printer className="h-4 w-4" /> Cetak / Simpan PDF
      </button>
    </div>
  );
}
