import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PrintToolbar } from '@/components/print/PrintToolbar';
import { getCurrentUser } from '@/lib/auth-server';
import { getStockGroup, parseStockGroup } from '@/lib/stock-groups';
import { ReportService } from '@/services/report.service';

const FONT = { fontFamily: 'Arial, Helvetica, sans-serif' };
const cell = 'border border-black px-2 py-1';

function resolveParams(searchParams: { jenis?: string; days?: string }) {
  const stockGroup = parseStockGroup(searchParams.jenis) ?? undefined;
  const rawDays = parseInt(searchParams.days || '30', 10);
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 365) : 30;
  const groupLabel = stockGroup ? getStockGroup(stockGroup).label : 'Semua Jenis';
  const groupShort = stockGroup ? getStockGroup(stockGroup).shortLabel : 'Semua Jenis';
  const todayFile = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const documentTitle = `Ringkasan Persediaan & Pengadaan ${groupShort} - ${days} Hari (${todayFile})`;
  return { stockGroup, days, groupLabel, documentTitle };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { jenis?: string; days?: string };
}): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user) return { title: 'Login - StockFlow' };
  return { title: resolveParams(searchParams).documentTitle };
}

export default async function PrintInventorySummaryPage({
  searchParams,
}: {
  searchParams: { jenis?: string; days?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const { stockGroup, days, groupLabel, documentTitle } = resolveParams(searchParams);
  const summary = await ReportService.getDashboardSummary(days, stockGroup);
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
          Laporan Ringkasan Persediaan & Usulan Pengadaan
        </h1>
        <p className="text-center text-[12px]">
          Jenis Stok: <strong>{groupLabel}</strong> · Periode Evaluasi: <strong>{days} Hari Terakhir</strong> · Dicetak: {today}
        </p>

        <table className="mt-4 w-full border-collapse border border-black text-[11px]">
          <tbody>
            <tr>
              <td className={cell}>Total Jenis Barang Aktif: <strong>{summary.kpi.totalActiveSku} SKU</strong></td>
              <td className={cell}>Total Persediaan Fisik: <strong>{summary.kpi.totalAggregateStock} unit</strong></td>
              <td className={cell}>Perlu Pengadaan: <strong>{summary.criticalItems.length} barang</strong> ({summary.kpi.outOfStockCount} habis, {summary.kpi.lowStockCount} menipis)</td>
            </tr>
            <tr>
              <td className={cell}>Total Barang Masuk ({days} hr): <strong>+{summary.kpi.totalInQuantity}</strong></td>
              <td className={cell}>Total Barang Keluar ({days} hr): <strong>-{summary.kpi.totalOutQuantity}</strong></td>
              <td className={cell}>Selisih Pergerakan (Net): <strong>{summary.kpi.netMovement > 0 ? `+${summary.kpi.netMovement}` : summary.kpi.netMovement}</strong></td>
            </tr>
          </tbody>
        </table>

        <h2 className="mt-5 text-[13px] font-bold">A. Daftar Usulan Pengadaan Barang (Stok Habis & Menipis)</h2>
        <table className="mt-1 w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-slate-200">
              <th className={`${cell} w-8`}>No</th>
              <th className={cell}>Nama Barang</th>
              <th className={cell}>Jenis</th>
              <th className={cell}>Sisa Stok</th>
              <th className={cell}>Min.</th>
              <th className={cell}>Terpakai ({days} hr)</th>
              <th className={cell}>Usulan Beli</th>
              <th className={cell}>Status</th>
            </tr>
          </thead>
          <tbody>
            {summary.criticalItems.length === 0 ? (
              <tr>
                <td colSpan={8} className={`${cell} py-3 text-center italic`}>
                  Seluruh persediaan berada di atas batas minimum. Tidak ada usulan pengadaan mendesak.
                </td>
              </tr>
            ) : (
              summary.criticalItems.map((item, index) => (
                <tr key={item.id} className="break-inside-avoid">
                  <td className={`${cell} text-center`}>{index + 1}</td>
                  <td className={cell}>
                    <div className="font-semibold">{item.name}</div>
                    <div className="font-mono text-[9px] text-slate-600">{item.sku}</div>
                  </td>
                  <td className={`${cell} text-center`}>{item.stockGroupLabel}</td>
                  <td className={`${cell} text-center font-bold`}>{item.currentStock} {item.unit}</td>
                  <td className={`${cell} text-center`}>{item.minimumStock} {item.unit}</td>
                  <td className={`${cell} text-center`}>{item.usedInPeriod} {item.unit}</td>
                  <td className={`${cell} text-center font-bold`}>{item.suggestedOrder} {item.unit}</td>
                  <td className={`${cell} text-center`}>{item.isZero ? 'Habis' : 'Menipis'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {summary.criticalItems.length > 0 && (
          <p className="mt-1 text-[10px] italic text-slate-700">
            * Angka usulan beli merupakan estimasi otomatis berdasarkan selisih stok minimum dan pemakaian {days} hari terakhir, dapat disesuaikan saat pengajuan anggaran.
          </p>
        )}

        <h2 className="mt-5 text-[13px] font-bold">B. Barang Paling Banyak Digunakan ({days} Hari Terakhir)</h2>
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
                  <td className={`${cell} text-center font-semibold`}>{row.totalOut} {row.product.unit}</td>
                  <td className={`${cell} text-center`}>{row.txCount}x</td>
                  <td className={`${cell} text-center`}>{row.product.currentStock} {row.product.unit}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {summary.topUnits.length > 0 && (
          <>
            <h2 className="mt-5 text-[13px] font-bold">C. Rekap Unit / Gedung Penerima Paling Aktif ({days} Hari Terakhir)</h2>
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
