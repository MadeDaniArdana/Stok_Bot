import Link from 'next/link';
import { Send } from 'lucide-react';

export default function RequestsPage() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-soft">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-maroon-50 text-maroon-800">
        <Send className="h-6 w-6" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-slate-900">Tugas pemasangan melalui Telegram</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Persetujuan tugas tidak dilakukan di web. Admin membuat tugas di bot Telegram dan membagikan
        link kepada pemasang melalui WhatsApp. Status tugas dapat ditanyakan lewat perintah <code>/tugas</code>.
      </p>
      <Link
        href="/telegram"
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-maroon-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-maroon-900"
      >
        Buka panduan Telegram
      </Link>
    </div>
  );
}
