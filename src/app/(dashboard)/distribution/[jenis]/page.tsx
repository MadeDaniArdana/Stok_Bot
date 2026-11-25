import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { DistributionForm } from '@/components/distribution/DistributionForm';
import { STOCK_GROUPS, getStockGroup, parseStockGroup } from '@/lib/stock-groups';

export function generateStaticParams() {
  return STOCK_GROUPS.map((group) => ({ jenis: group.slug }));
}
export const dynamicParams = false;

/** Form Distribusi ATK / Peralatan Listrik / Logistik. */
export default async function DistributionPage({ params }: { params: Promise<{ jenis: string }> }) {
  const { jenis } = await params;
  const stockGroup = parseStockGroup(jenis);
  if (!stockGroup) notFound();
  const group = getStockGroup(stockGroup);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">Distribusi {group.label}</h1>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Catat pengiriman barang ke {group.id === 'LISTRIK' ? 'ruang' : 'unit'}. Stok berkurang otomatis dan form bisa langsung dicetak.
          </p>
        </div>
        <Link
          href={`/distribution-reports/${group.slug}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-soft hover:bg-slate-50"
        >
          <ClipboardList className="h-4 w-4" /> Laporan {group.label}
        </Link>
      </div>

      {group.id === 'LISTRIK' && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          Form ini menggantikan buku distribusi peralatan listrik (Tanggal, Alat, Ruang, Banyaknya, Nama). Untuk pemasangan yang
          membutuhkan foto bukti dari pemasang, tetap gunakan tugas pemasangan lewat bot Telegram.
        </p>
      )}

      <DistributionForm key={group.id} group={group} />
    </div>
  );
}
