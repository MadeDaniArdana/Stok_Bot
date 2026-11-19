'use client';

import { useEffect } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';

/** Tombol cetak di atas dokumen; tidak ikut tercetak. */
export function PrintToolbar({
  backHref,
  backLabel,
  documentTitle,
}: {
  backHref: string;
  backLabel: string;
  documentTitle?: string;
}) {
  useEffect(() => {
    if (documentTitle) document.title = documentTitle;
  }, [documentTitle]);

  const handlePrint = () => {
    if (documentTitle) document.title = documentTitle;
    window.print();
  };

  return (
    <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 font-sans print:hidden">
      <a href={backHref} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </a>
      <button
        type="button"
        onClick={handlePrint}
        className="inline-flex items-center gap-1.5 rounded-lg bg-maroon-800 px-4 py-2 text-xs font-semibold text-white hover:bg-maroon-900"
      >
        <Printer className="h-4 w-4" /> Cetak / Simpan PDF
      </button>
    </div>
  );
}
