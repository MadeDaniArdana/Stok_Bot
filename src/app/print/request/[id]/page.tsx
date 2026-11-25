import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PrintToolbar } from '@/components/print/PrintToolbar';
import { getSessionUser } from '@/lib/auth-server';
import { getStockGroup } from '@/lib/stock-groups';
import { RequestService } from '@/services/request.service';
import { itemName, itemQty } from '@/components/requests/shared';

const FONT = { fontFamily: 'Arial, Helvetica, sans-serif' };
const getRequest = cache((id: string) => RequestService.getForPrint(id));

const safe = (value: string) => value.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
const dayMonthYear = (date: Date) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' }).format(date);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const user = await getSessionUser(false);
  if (!user) return { title: 'Login - StockFlow' };
  const { id } = await params;
  const request = await getRequest(id);
  if (!request) return { title: 'Dokumen Tidak Ditemukan - StockFlow' };
  return { title: `Form Pengajuan ${getStockGroup(request.stockGroup).shortLabel} - ${safe(request.divisionName)} (${request.number})` };
}

/** Formulir PDF pengajuan barang divisi (Jumlah Pengajuan vs Jumlah ACC + tanda tangan digital). */
export default async function PrintRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(false);
  if (!user) redirect('/login');
  const { id } = await params;
  const request = await getRequest(id);
  // Akun divisi hanya boleh membuka formulir miliknya sendiri.
  if (!request || (user.role !== 'ADMIN' && request.requesterId !== user.id)) notFound();

  const group = getStockGroup(request.stockGroup);
  const approved = request.status === 'APPROVED';
  const signedDate = approved ? request.approvedDate ?? request.decidedAt ?? request.createdAt : request.createdAt;
  const documentTitle = `Form Pengajuan ${group.shortLabel} - ${safe(request.divisionName)} (${request.number})`;
  const cell = 'border border-black px-2 py-0.5';

  return (
    <>
      <style>{'@page { size: A5 portrait; margin: 10mm; }'}</style>
      <PrintToolbar
        backHref={user.role === 'ADMIN' ? '/requests/history' : '/divisi/riwayat'}
        backLabel="Kembali"
        documentTitle={documentTitle}
      />

      <article style={FONT} className="relative mx-auto max-w-[148mm] bg-white p-8 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-yayasan.png" alt="" className="h-11 w-11 object-contain" />
            <div>
              <p style={{ fontFamily: '"Times New Roman", Times, serif' }} className="text-[10px] font-bold uppercase leading-none tracking-wide">Yayasan Pendidikan</p>
              <p className="text-[18px] font-black uppercase leading-none tracking-tight text-[#800020]">Teknokrat</p>
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

        <h1 className="mt-4 text-center text-[15px] font-bold uppercase">FORM DISTRIBUSI BARANG</h1>
        <p className="text-center font-mono text-[10px] text-slate-500">{request.number}</p>

        <table className="mt-4 text-[12px] font-bold">
          <tbody>
            <tr><td className="w-32 py-0.5">Kepada</td><td>: {request.divisionName}</td></tr>
            <tr><td className="py-0.5">No. Nota Pesanan</td><td>: -</td></tr>
            <tr><td className="py-0.5">Tgl Pesanan</td><td>: {dayMonthYear(request.createdAt)}</td></tr>
          </tbody>
        </table>

        <table className="mt-3 w-full border-collapse border border-black text-[12px]">
          <thead>
            <tr className="bg-slate-200 print:bg-slate-200">
              <th className="w-8 border border-black px-1 py-1">No</th>
              <th className="border border-black px-2 py-1">Nama Barang</th>
              <th className="w-[4.5rem] border border-black px-1 py-1 leading-tight">Jumlah Pengajuan</th>
              <th className="w-[4.5rem] border border-black px-1 py-1 leading-tight">Jumlah ACC</th>
              <th className="w-28 border border-black px-2 py-1 leading-tight">Tempat Penyimpanan</th>
            </tr>
          </thead>
          <tbody>
            {request.items.map((item, index) => (
              <tr key={item.id}>
                <td className="border border-black px-1 py-0.5 text-center">{index + 1}</td>
                <td className={cell}>{itemName(item)}</td>
                <td className={`${cell} text-center`}>{itemQty(item, item.quantity)}</td>
                <td className={`${cell} text-center`}>{approved && item.approvedQuantity !== null ? itemQty(item, item.approvedQuantity) : '-'}</td>
                {index === 0 && (
                  <td rowSpan={request.items.length} className="border border-black px-2 py-1 text-center align-middle">
                    {request.storageLocation || request.divisionName}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {request.notes && <p className="mt-2 text-[11px] italic">Catatan: {request.notes}</p>}

        <footer className="mt-6 grid grid-cols-2 gap-6 text-[12px]">
          <div>
            <p>&nbsp;</p>
            <p>Penerima,</p>
            <div className="flex h-16 items-center">
              {request.requesterSignature && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={request.requesterSignature} alt="Tanda tangan penerima" className="max-h-16 max-w-full object-contain" />
              )}
            </div>
            <p className="font-bold">{request.receiverName || request.requesterName}</p>
          </div>
          <div className="text-left">
            <p>Bandarlampung, {dayMonthYear(signedDate)}</p>
            <p>Yang menyerahkan,</p>
            <div className="flex h-16 items-center">
              {request.adminSignature && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={request.adminSignature} alt="Tanda tangan penyerah" className="max-h-16 max-w-full object-contain" />
              )}
            </div>
            <p className="font-bold">{approved ? request.decidedByName : '(.................................)'}</p>
          </div>
        </footer>
      </article>
    </>
  );
}
