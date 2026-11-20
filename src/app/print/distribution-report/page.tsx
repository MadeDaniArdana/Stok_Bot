import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PrintToolbar } from '@/components/print/PrintToolbar';
import { getCurrentUser } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { getCurrentReportMonth, getReportMonthRange } from '@/lib/report-period';
import { DEFAULT_STOCK_GROUP, getStockGroup, parseStockGroup } from '@/lib/stock-groups';

const FONT = { fontFamily: 'Arial, Helvetica, sans-serif' };
const cell = 'border border-black px-2 py-0.5';

const shortDate = (date: Date) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'numeric', year: 'numeric' }).format(date);

function resolveReportParams(searchParams: { jenis?: string; month?: string }) {
  const group = getStockGroup(parseStockGroup(searchParams.jenis) ?? DEFAULT_STOCK_GROUP);
  let month = searchParams.month || getCurrentReportMonth();
  let range;
  try {
    range = getReportMonthRange(month);
  } catch {
    month = getCurrentReportMonth();
    range = getReportMonthRange(month);
  }
  const [year, monthNumber] = month.split('-').map(Number);
  const periodLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthNumber - 1, 15)));
  const documentTitle = `Laporan Distribusi ${group.shortLabel} - ${periodLabel}`;
  return { group, month, range, periodLabel, documentTitle };
}

export function generateMetadata({ searchParams }: { searchParams: { jenis?: string; month?: string } }): Metadata {
  return { title: resolveReportParams(searchParams).documentTitle };
}

export default async function PrintDistributionReportPage({ searchParams }: { searchParams: { jenis?: string; month?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { group, month, range, periodLabel, documentTitle } = resolveReportParams(searchParams);
  const isListrik = group.id === 'LISTRIK';

  const distributions = await prisma.distribution.findMany({
    where: { stockGroup: group.id, distributedAt: range, status: 'COMPLETED' },
    orderBy: [{ distributedAt: 'asc' }, { createdAt: 'asc' }],
    include: { items: { include: { product: { select: { id: true, name: true, sku: true } } }, orderBy: { id: 'asc' } } },
  });

  const lines = distributions.flatMap((distribution) => distribution.items.map((item) => ({ distribution, item })));
  const recap = new Map<string, { name: string; sku: string; unit: string; quantity: number; times: number }>();
  for (const { item } of lines) {
    const entry = recap.get(item.product.id) ?? { name: item.product.name, sku: item.product.sku, unit: item.unit, quantity: 0, times: 0 };
    entry.quantity += item.quantity;
    entry.times += 1;
    recap.set(item.product.id, entry);
  }
  const recapRows = Array.from(recap.values()).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'id'));
  const today = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return (
    <>
      <style>{'@page { size: A4 portrait; margin: 12mm; }'}</style>
      <PrintToolbar backHref={`/distribution-reports/${group.slug}?month=${month}`} backLabel="Kembali ke Laporan" documentTitle={documentTitle} />

      <article style={FONT} className="mx-auto max-w-[210mm] bg-white p-10 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-center gap-3 border-b-2 border-black pb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-yayasan.png" alt="" className="h-12 w-12 object-contain" />
          <div>
            <p className="text-[16px] font-bold uppercase leading-none tracking-wide">Universitas <span className="text-[#800020]">Teknokrat</span> Indonesia</p>
            <p className="mt-1 text-[11px] leading-none">Bagian Umum dan Rumah Tangga</p>
          </div>
        </header>

        <h1 className="mt-4 text-center text-[15px] font-bold uppercase">Laporan Distribusi {group.label}</h1>
        <p className="text-center text-[12px]">Periode: {periodLabel}</p>

        <p className="mt-4 text-[12px]">
          Jumlah dokumen: <strong>{distributions.length}</strong> · Baris barang: <strong>{lines.length}</strong> · Jenis barang: <strong>{recapRows.length}</strong>
        </p>

        <h2 className="mt-4 text-[13px] font-bold">A. Rekapitulasi per Barang</h2>
        <table className="mt-1 w-full border-collapse border border-black text-[12px]">
          <thead>
            <tr className="bg-slate-200">
              <th className={`${cell} w-8`}>No</th>
              <th className={cell}>Nama Barang</th>
              <th className={cell}>Kode</th>
              <th className={cell}>Jumlah Keluar</th>
              <th className={cell}>Frekuensi</th>
            </tr>
          </thead>
          <tbody>
            {recapRows.length === 0 ? (
              <tr><td colSpan={5} className={`${cell} py-3 text-center italic`}>Tidak ada distribusi pada periode ini.</td></tr>
            ) : (
              recapRows.map((row, index) => (
                <tr key={row.sku}>
                  <td className={`${cell} text-center`}>{index + 1}</td>
                  <td className={cell}>{row.name}</td>
                  <td className={`${cell} font-mono text-[10px]`}>{row.sku}</td>
                  <td className={`${cell} text-center`}>{row.quantity} {row.unit}</td>
                  <td className={`${cell} text-center`}>{row.times}x</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <h2 className="mt-5 text-[13px] font-bold">B. Rincian Distribusi</h2>
        <table className="mt-1 w-full border-collapse border border-black text-[12px]">
          <thead>
            {isListrik ? (
              <tr className="bg-slate-200">
                <th className={`${cell} w-8`}>No</th>
                <th className={cell}>Tanggal</th>
                <th className={cell}>Alat</th>
                <th className={cell}>Ruang</th>
                <th className={cell}>Banyaknya</th>
                <th className={cell}>Nama</th>
              </tr>
            ) : (
              <tr className="bg-slate-200">
                <th className={`${cell} w-8`}>No</th>
                <th className={cell}>Tanggal</th>
                <th className={cell}>Kepada</th>
                <th className={cell}>Nama Barang</th>
                <th className={cell}>Jumlah</th>
                <th className={cell}>Penerima</th>
              </tr>
            )}
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={6} className={`${cell} py-3 text-center italic`}>Tidak ada data.</td></tr>
            ) : (
              lines.map(({ distribution, item }, index) => (
                <tr key={item.id} className="break-inside-avoid">
                  <td className={`${cell} text-center`}>{index + 1}</td>
                  <td className={`${cell} whitespace-nowrap`}>{shortDate(distribution.distributedAt)}</td>
                  {isListrik ? (
                    <>
                      <td className={cell}>{item.product.name}</td>
                      <td className={cell}>{distribution.recipientUnit}</td>
                      <td className={`${cell} text-center`}>{item.quantity} {item.unit}</td>
                      <td className={cell}>{distribution.handoverName}</td>
                    </>
                  ) : (
                    <>
                      <td className={cell}>{distribution.recipientUnit}</td>
                      <td className={cell}>{item.product.name}</td>
                      <td className={`${cell} text-center`}>{item.quantity} {item.unit}</td>
                      <td className={cell}>{distribution.receiverName || '-'}</td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <footer className="mt-10 grid grid-cols-2 gap-6 text-[12px] break-inside-avoid">
          <div>
            <p>&nbsp;</p>
            <p>Mengetahui,</p>
            <div className="h-16" />
            <p>(.................................)</p>
          </div>
          <div>
            <p>Bandar Lampung, {today}</p>
            <p>Yang membuat laporan,</p>
            <div className="h-16" />
            <p className="font-bold">{user?.name || '(.................................)'}</p>
          </div>
        </footer>
      </article>
    </>
  );
}
