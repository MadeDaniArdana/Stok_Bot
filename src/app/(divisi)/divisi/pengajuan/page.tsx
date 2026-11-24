import { DivisiRequestForm } from '@/components/requests/DivisiRequestForm';

export default function DivisiRequestPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Buat Pengajuan Barang</h1>
        <p className="text-xs text-slate-500">Isi jumlah pada barang yang dibutuhkan. Pengajuan akan diteruskan ke admin untuk disetujui.</p>
      </div>
      <DivisiRequestForm />
    </div>
  );
}
