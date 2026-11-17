import { notFound } from 'next/navigation';
import { PrintToolbar } from '@/components/print/PrintToolbar';
import { getStockGroup } from '@/lib/stock-groups';
import { DistributionService } from '@/services/distribution.service';

const TIMES = { fontFamily: '"Times New Roman", Times, serif' };

const longDate = (date: Date) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
const shortDate = (date: Date) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'numeric', year: '2-digit' }).format(date).replace(/\//g, '-');
const monthYear = (date: Date) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', month: 'short', year: 'numeric' }).format(date);

export default async function PrintDistributionPage({ params }: { params: { id: string } }) {
  const distribution = await DistributionService.getById(params.id);
  if (!distribution) notFound();
  const group = getStockGroup(distribution.stockGroup);
  const cancelled = distribution.status === 'CANCELLED';
  const isListrik = group.id === 'LISTRIK';
  // Minimal 5 baris agar form tetap terlihat seperti blanko kertas walau barangnya sedikit.
  const blankRows = Math.max(0, 5 - distribution.items.length);

  return (
    <>
      <style>{`@page { size: ${isListrik ? 'A4 landscape' : 'A5 portrait'}; margin: 10mm; }`}</style>
      <PrintToolbar backHref={`/distribution-reports/${group.slug}`} backLabel="Kembali ke Riwayat" />

      <article
        style={TIMES}
        className={`relative mx-auto bg-white p-8 shadow-lg print:max-w-none print:p-0 print:shadow-none ${isListrik ? 'max-w-[277mm]' : 'max-w-[148mm]'}`}
      >
        {cancelled && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rotate-[-20deg] rounded border-4 border-red-600/60 px-6 py-2 text-4xl font-bold tracking-widest text-red-600/60">DIBATALKAN</span>
          </div>
        )}

        {/* Kop */}
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-teknokrat.png" alt="" className="h-10 w-10" />
            <div className="leading-tight">
              {isListrik ? (
                <>
                  <p className="text-[13px] font-bold uppercase">Universitas Teknokrat Indonesia</p>
                  <p className="text-[10px] italic">Bagian Rumah Tangga</p>
                </>
              ) : (
                <>
                  <p className="text-[9px] uppercase tracking-wide">Yayasan Pendidikan</p>
                  <p className="text-[17px] font-black uppercase tracking-tight">Teknokrat</p>
                </>
              )}
            </div>
          </div>
          {group.documentCode && (
            <table className="text-[11px]">
              <tbody>
                <tr><td className="pr-1">Kode Dok</td><td>: {group.documentCode}</td></tr>
                <tr><td className="pr-1">Revisi</td><td>: {group.documentRevision}</td></tr>
              </tbody>
            </table>
          )}
        </header>

        <h1 className="mt-4 text-center text-[15px] font-bold uppercase">{group.formTitle}</h1>
        <p className="text-center font-mono text-[10px] text-slate-500">{distribution.number}</p>

        {isListrik ? (
          <table className="mt-4 w-full border-collapse border border-black text-[12px]">
            <thead>
              <tr className="bg-slate-200 print:bg-slate-200">
                <th className="border border-black px-2 py-1">Tanggal</th>
                <th className="border border-black px-2 py-1">Alat</th>
                <th className="border border-black px-2 py-1">Ruang</th>
                <th className="border border-black px-2 py-1">Banyaknya</th>
                <th className="border border-black px-2 py-1">Nama</th>
              </tr>
            </thead>
            <tbody>
              {distribution.items.map((item) => (
                <tr key={item.id}>
                  <td className="border border-black px-2 py-1 text-center">{shortDate(distribution.distributedAt)}</td>
                  <td className="border border-black px-2 py-1">{item.product.name}</td>
                  <td className="border border-black px-2 py-1">{distribution.recipientUnit}</td>
                  <td className="border border-black px-2 py-1 text-center">{item.quantity} {item.unit}</td>
                  <td className="border border-black px-2 py-1">{distribution.handoverName}</td>
                </tr>
              ))}
              {Array.from({ length: blankRows }).map((_, index) => (
                <tr key={`blank-${index}`}>
                  {Array.from({ length: 5 }).map((__, cell) => <td key={cell} className="border border-black px-2 py-1">&nbsp;</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <>
            <table className="mt-4 text-[12px] font-bold">
              <tbody>
                <tr><td className="w-32 py-0.5">Kepada</td><td>: {distribution.recipientUnit}</td></tr>
                <tr><td className="py-0.5">No. Nota Pesanan</td><td>: {distribution.orderNumber || '-'}</td></tr>
                <tr><td className="py-0.5">Tgl Pesanan</td><td>: {longDate(distribution.distributedAt)}</td></tr>
              </tbody>
            </table>

            <table className="mt-3 w-full border-collapse border border-black text-[12px]">
              <thead>
                <tr className="bg-slate-200 print:bg-slate-200">
                  <th className="w-8 border border-black px-1 py-1">No</th>
                  <th className="border border-black px-2 py-1">Nama Barang</th>
                  <th className="w-20 border border-black px-2 py-1">Jumlah</th>
                  <th className="w-32 border border-black px-2 py-1">Tempat Penyimpanan</th>
                </tr>
              </thead>
              <tbody>
                {distribution.items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="border border-black px-1 py-0.5 text-center">{index + 1}</td>
                    <td className="border border-black px-2 py-0.5">{item.product.name}</td>
                    <td className="border border-black px-2 py-0.5 text-center">{item.quantity} {item.unit}</td>
                    {index === 0 && (
                      <td rowSpan={distribution.items.length + blankRows} className="border border-black px-2 py-1 text-center align-middle">
                        {distribution.storageLocation || distribution.recipientUnit}
                      </td>
                    )}
                  </tr>
                ))}
                {Array.from({ length: blankRows }).map((_, index) => (
                  <tr key={`blank-${index}`}>
                    <td className="border border-black px-1 py-0.5">&nbsp;</td>
                    <td className="border border-black px-2 py-0.5" />
                    <td className="border border-black px-2 py-0.5" />
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {distribution.notes && <p className="mt-2 text-[11px] italic">Catatan: {distribution.notes}</p>}
        {cancelled && <p className="mt-1 text-[11px] text-red-700">Dibatalkan: {distribution.cancelReason}</p>}

        {/* Tanda tangan */}
        <footer className="mt-6 grid grid-cols-2 gap-6 text-[12px]">
          <div>
            <p>&nbsp;</p>
            <p>Penerima,</p>
            <div className="h-16" />
            <p className="font-bold">{distribution.receiverName || '(.................................)'}</p>
            {!isListrik && distribution.receiverName !== distribution.recipientUnit && (
              <p className="text-[11px]">{distribution.recipientUnit}</p>
            )}
          </div>
          <div className="text-left">
            <p>Bandarlampung, {monthYear(distribution.distributedAt)}</p>
            <p>{isListrik ? 'Petugas,' : 'Yang menyerahkan,'}</p>
            <div className="h-16" />
            <p className="font-bold">{distribution.handoverName}</p>
          </div>
        </footer>
      </article>
    </>
  );
}
