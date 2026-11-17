import Link from 'next/link';
import { Send } from 'lucide-react';

export default function StockOutPage() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-soft">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-maroon-50 text-maroon-800">
        <Send className="h-6 w-6" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-slate-900">Pencatatan Barang Keluar</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Barang keluar dicatat melalui <strong>Form Distribusi</strong> (Peralatan Listrik, Logistik, ATK) atau
        melalui tugas pemasangan di Telegram yang mengurangi stok setelah pemasang mengirim foto bukti.
      </p>
      <Link
        href="/distribution/atk"
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-maroon-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-maroon-900"
      >
        Buka Form Distribusi
      </Link>
    </div>
  );
}
