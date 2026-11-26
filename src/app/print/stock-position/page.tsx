import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PrintToolbar } from '@/components/print/PrintToolbar';
import { getCurrentUser } from '@/lib/auth-server';
import { formatStock } from '@/lib/product-units';
import { parseStockReportPeriod } from '@/lib/report-period';
import { getStockGroup, parseStockGroup } from '@/lib/stock-groups';
import { ReportService } from '@/services/report.service';

const FONT = { fontFamily: 'Arial, Helvetica, sans-serif' };
const cell = 'border border-black px-1.5 py-1';

type Search = { jenis?: string; periode?: string };

function resolveParams(searchParams: Search) {
  const stockGroup = parseStockGroup(searchParams.jenis) ?? undefined;
  const period = parseStockReportPeriod(searchParams.periode);
  const groupLabel = stockGroup ? getStockGroup(stockGroup).label : 'Semua Jenis';
  const groupShort = stockGroup ? getStockGroup(stockGroup).shortLabel : 'Semua Jenis';
  const documentTitle = `Riwayat Stok ${groupShort} - ${period.label}`;
  return { stockGroup, period, groupLabel, documentTitle };
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user) return { title: 'Login - StockFlow' };
  return { title: resolveParams(await searchParams).documentTitle };
}

export default async function PrintStockPositionPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { stockGroup, period, groupLabel, documentTitle } = resolveParams(await searchParams);
  const report = await ReportService.getStockPositionReport(period, stockGroup);
  const today = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
  const qty = (row: (typeof report.rows)[number], value: number) =>
    value < 0 ? `-${formatStock(row, -value)}` : formatStock(row, value);
  const showAdj = report.hasAdjustment;

  return (
    <>
      <style>{'@page { size: A4 portrait; margin: 12mm; }'}</style>
      <PrintToolbar backHref="/reports" backLabel="Kembali ke Ringkasan" documentTitle={documentTitle} />

      <article style={FONT} className="mx-auto max-w-[210mm] bg-white p-10 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-center gap-3 border-b-2 border-black pb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-yayasan.png" alt="" className="h-12 w-12 object-contain" />
          <div>
            <p className="text-[16px] font-bold uppercase leading-none tracking-wide">
              Universitas <span className="text-[#800020]">Teknokrat</span> Indonesia
            </p>
            <p className="mt-1 text-[11px] leading-none">Bagian Umum dan Rumah Tangga</p>
          </div>
        </header>

        <h1 className="mt-4 text-center text-[15px] font-bold uppercase">
          Laporan Riwayat Stok {period.kind === 'year' ? 'Tahunan' : 'Bulanan'}
        </h1>
        <p className="text-center text-[12px]">
          Jenis Stok: <strong>{groupLabel}</strong> · Periode: <strong>{period.label}</strong> · Dicetak: {today}
        </p>

        <table className="mt-4 w-full border-collapse border border-black text-[10.5px]">
          <thead>
            <tr className="bg-slate-200">
              <th className={`${cell} w-7`}>No</th>
              <th className={cell}>Nama Barang</th>
              <th className={cell}>Jenis</th>
              <th className={cell}>Stok Awal<br /><span className="font-normal">({period.openingLabel})</span></th>
              <th className={cell}>Barang Masuk</th>
              <th className={cell}>Total<br /><span className="font-normal">(Awal + Masuk)</span></th>
              <th className={cell}>Keluar</th>
              {showAdj && <th className={cell}>Penyesuaian</th>}
              <th className={cell}>Sisa Akhir</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={showAdj ? 9 : 8} className={`${cell} py-3 text-center italic`}>
                  Belum ada data barang pada periode ini.
                </td>
              </tr>
            ) : (
              report.rows.map((row, index) => (
                <tr key={row.id} className="break-inside-avoid">
                  <td className={`${cell} text-center`}>{index + 1}</td>
                  <td className={cell}>
                    <div className="font-semibold">{row.name}</div>
                    <div className="font-mono text-[9px] text-slate-600">{row.sku} · {row.category}</div>
                  </td>
                  <td className={`${cell} text-center`}>{row.stockGroupLabel}</td>
                  <td className={`${cell} text-center`}>{qty(row, row.openingStock)}</td>
                  <td className={`${cell} text-center`}>{row.inQty ? qty(row, row.inQty) : '-'}</td>
                  <td className={`${cell} text-center font-semibold`}>{qty(row, row.totalAvailable)}</td>
                  <td className={`${cell} text-center`}>{row.outQty ? qty(row, row.outQty) : '-'}</td>
                  {showAdj && <td className={`${cell} text-center`}>{row.adjustment ? (row.adjustment > 0 ? '+' : '') + qty(row, row.adjustment) : '-'}</td>}
                  <td className={`${cell} text-center font-bold`}>{qty(row, row.closingStock)}</td>
                </tr>
              ))
            )}
          </tbody>
          {report.rows.length > 0 && (
            <tfoot>
              {report.totalsByUnit.map((t) => (
              <tr key={t.unit} className="bg-slate-100 font-bold">
                <td className={`${cell} text-center`} colSpan={3}>Subtotal {t.unit} ({t.itemCount} jenis barang)</td>
                <td className={`${cell} text-center`}>{t.openingStock}</td>
                <td className={`${cell} text-center`}>{t.inQty}</td>
                <td className={`${cell} text-center`}>{t.totalAvailable}</td>
                <td className={`${cell} text-center`}>{t.outQty}</td>
                {showAdj && <td className={`${cell} text-center`}>{t.adjustment}</td>}
                <td className={`${cell} text-center`}>{t.closingStock}</td>
              </tr>
              ))}
            </tfoot>
          )}
        </table>
        <p className="mt-1 text-[10px] italic text-slate-700">
          * Total = Stok Awal + Barang Masuk. Sisa Akhir = Total − Keluar{showAdj ? ' ± Penyesuaian' : ''}. Subtotal dihitung per satuan dasar.
        </p>

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
