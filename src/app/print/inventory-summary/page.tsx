import { ReportLetterhead } from '@/components/print/ReportLetterhead';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PrintToolbar } from '@/components/print/PrintToolbar';
import { getCurrentUser } from '@/lib/auth-server';
import { getStockGroup, parseStockGroup } from '@/lib/stock-groups';
import { resolveSummaryPeriod } from '@/lib/report-period';
import { ReportService } from '@/services/report.service';
import { formatStock } from '@/lib/product-units';

const FONT = { fontFamily: 'Arial, Helvetica, sans-serif' };
const cell = 'border border-black px-2 py-1';

type Search = { jenis?: string; days?: string; periode?: string };

function resolveParams(searchParams: Search) {
  const stockGroup = parseStockGroup(searchParams.jenis) ?? undefined;
  const period = resolveSummaryPeriod(searchParams.periode, searchParams.days);
  const periodLabel = typeof period === 'number' ? `${period} Hari Terakhir` : period.label;
  const groupLabel = stockGroup ? getStockGroup(stockGroup).label : 'Semua Jenis';
  const groupShort = stockGroup ? getStockGroup(stockGroup).shortLabel : 'Semua Jenis';
  const documentTitle = `Ringkasan Persediaan & Pengadaan ${groupShort} - ${periodLabel}`;
  return { stockGroup, period, periodLabel, groupLabel, documentTitle };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user) return { title: 'Login - StockFlow' };
  return { title: resolveParams(await searchParams).documentTitle };
}

export default async function PrintInventorySummaryPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { stockGroup, period, periodLabel, groupLabel, documentTitle } = resolveParams(await searchParams);
  const summary = await ReportService.getDashboardSummary(period, stockGroup);
  const today = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <>
      <style>{'@page { size: A4 portrait; margin: 12mm; }'}</style>
      <PrintToolbar backHref="/reports" backLabel="Kembali ke Ringkasan" documentTitle={documentTitle} />

      <article style={FONT} className="mx-auto max-w-[210mm] bg-white p-10 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <ReportLetterhead />

        <h1 className="mt-4 text-center text-[15px] font-bold uppercase">
          Laporan Ringkasan Persediaan & Usulan Pengadaan
        </h1>
        <p className="text-center text-[12px]">
          Jenis Stok: <strong>{groupLabel}</strong> · Periode: <strong>{periodLabel}</strong> · Dicetak: {today}
        </p>

        <table className="mt-4 w-full border-collapse border border-black text-[11px]">
          <tbody>
            <tr>
              <td className={cell}>Total Jenis Barang Aktif: <strong>{summary.kpi.totalActiveSku} SKU</strong></td>
              <td className={cell}>Jenis Barang Tersedia pada Akhir Periode: <strong>{summary.kpi.inStockSku} SKU</strong></td>
              <td className={cell}>Perlu Pengadaan: <strong>{summary.criticalItems.length} barang</strong> ({summary.kpi.outOfStockCount} habis, {summary.kpi.lowStockCount} menipis)</td>
            </tr>
            <tr>
              <td className={cell}>Jenis Barang Masuk: <strong>{summary.kpi.incomingSku} SKU</strong></td>
              <td className={cell}>Jenis Barang Keluar: <strong>{summary.kpi.outgoingSku} SKU</strong></td>
              <td className={cell}>Jenis Barang Bermutasi: <strong>{summary.kpi.movedSku} SKU</strong></td>
            </tr>
          </tbody>
        </table>

        <h2 className="mt-5 text-[13px] font-bold">A. Daftar Usulan Pengadaan Barang (Stok Habis & Menipis)</h2>
        <table className="mt-1 w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-slate-200">
              <th className={`${cell} w-8`}>No</th>
              <th className={cell}>Nama Barang</th>
              <th className={cell}>Stok Sisa<br /><span className="font-normal">({summary.period.openingLabel})</span></th>
              <th className={cell}>Stok Masuk</th>
              <th className={cell}>Jumlah Stok</th>
            </tr>
          </thead>
          <tbody>
            {summary.criticalItems.length === 0 ? (
              <tr>
                <td colSpan={5} className={`${cell} py-3 text-center italic`}>
                  Seluruh persediaan berada di atas batas minimum. Tidak ada usulan pengadaan mendesak.
                </td>
              </tr>
            ) : (
              summary.criticalItems.map((item, index) => {
                return (
                  <tr key={item.id} className="break-inside-avoid">
                    <td className={`${cell} text-center`}>{index + 1}</td>
                    <td className={cell}>
                      <div className="font-semibold">{item.name}</div>
                      <div className="font-mono text-[9px] text-slate-600">{item.sku} · {item.stockGroupLabel}</div>
                    </td>
                    <td className={`${cell} text-center`}>{formatStock(item, item.remainingStock)}</td>
                    <td className={`${cell} text-center`}>{item.incomingStock ? formatStock(item, item.incomingStock) : '-'}</td>
                    <td className={`${cell} text-center font-bold`}>{formatStock(item, item.totalStock)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {summary.criticalItems.length > 0 && (
          <p className="mt-1 text-[10px] italic text-slate-700">
            * Stok Sisa = sisa dari periode sebelumnya; Stok Masuk = barang masuk selama {periodLabel}; Jumlah Stok = Stok Sisa + Stok Masuk.
          </p>
        )}

        <h2 className="mt-5 text-[13px] font-bold">B. Barang Paling Banyak Digunakan ({periodLabel})</h2>
        <table className="mt-1 w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-slate-200">
              <th className={`${cell} w-8`}>No</th>
              <th className={cell}>Nama Barang</th>
              <th className={cell}>Kode</th>
              <th className={cell}>Jenis</th>
              <th className={cell}>Total Keluar</th>
              <th className={cell}>Frekuensi</th>
              <th className={cell}>Sisa Stok</th>
            </tr>
          </thead>
          <tbody>
            {summary.topConsumed.length === 0 ? (
              <tr>
                <td colSpan={7} className={`${cell} py-3 text-center italic`}>
                  Belum ada pemakaian barang pada periode ini.
                </td>
              </tr>
            ) : (
              summary.topConsumed.map((row, index) => (
                <tr key={`${row.product.sku}-${index}`} className="break-inside-avoid">
                  <td className={`${cell} text-center`}>{index + 1}</td>
                  <td className={cell}>{row.product.name}</td>
                  <td className={`${cell} font-mono text-[10px]`}>{row.product.sku}</td>
                  <td className={`${cell} text-center`}>{row.product.stockGroup}</td>
                  <td className={`${cell} text-center font-semibold`}>{formatStock(row.product, row.totalOut)}</td>
                  <td className={`${cell} text-center`}>{row.txCount}x</td>
                  <td className={`${cell} text-center`}>{formatStock(row.product, row.product.currentStock)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {summary.topUnits.length > 0 && (
          <>
            <h2 className="mt-5 text-[13px] font-bold">C. Rekap Unit / Gedung Penerima Paling Aktif ({periodLabel})</h2>
            <table className="mt-1 w-full border-collapse border border-black text-[11px]">
              <thead>
                <tr className="bg-slate-200">
                  <th className={`${cell} w-8`}>No</th>
                  <th className={cell}>Unit / Bagian / Gedung</th>
                  <th className={cell}>Jumlah Dokumen Distribusi</th>
                  <th className={cell}>Total Baris Barang</th>
                </tr>
              </thead>
              <tbody>
                {summary.topUnits.map((unit, index) => (
                  <tr key={unit.unit} className="break-inside-avoid">
                    <td className={`${cell} text-center`}>{index + 1}</td>
                    <td className={cell}>{unit.unit}</td>
                    <td className={`${cell} text-center`}>{unit.distributions} dokumen</td>
                    <td className={`${cell} text-center`}>{unit.itemLines} item</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

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
            <p className="font-bold">{user.name}</p>
          </div>
        </footer>
      </article>
    </>
  );
}
