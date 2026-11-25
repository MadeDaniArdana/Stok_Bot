import { DivisiRequestForm } from '@/components/requests/DivisiRequestForm';

export default function DivisiRequestPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Buat Pengajuan ATK</h1>
        <p className="text-xs text-slate-500">Isi jumlah barang ATK yang dibutuhkan. Pengajuan akan diteruskan ke admin untuk direview dan di-ACC.</p>
      </div>
      <DivisiRequestForm />
    </div>
  );
}
