import { DivisiRequestHistory } from '@/components/requests/DivisiRequestHistory';

export default function DivisiHistoryPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Riwayat Pengajuan</h1>
        <p className="text-xs text-slate-500">Semua pengajuan yang pernah Anda kirim beserta statusnya.</p>
      </div>
      <DivisiRequestHistory />
    </div>
  );
}
