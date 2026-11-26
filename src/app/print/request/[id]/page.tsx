import { ReportLetterhead } from '@/components/print/ReportLetterhead';
import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PrintToolbar } from '@/components/print/PrintToolbar';
import { getSessionUser } from '@/lib/auth-server';
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
  return { title: `Pengajuan Pengadaan ATK - ${safe(request.divisionName)} (${request.number})` };
}

/**
 * Formulir cetak Pengajuan Pengadaan Barang ATK dari Divisi,
 * mengikuti template resmi "Format Pengajuan ATK dari Divisi.xlsx".
 */
export default async function PrintRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(false);
  if (!user) redirect('/login');
  const { id } = await params;
  const request = await getRequest(id);
  // Akun divisi hanya boleh membuka formulir miliknya sendiri.
  if (!request || (user.role !== 'ADMIN' && request.requesterId !== user.id)) notFound();

  const documentTitle = `Pengajuan Pengadaan ATK - ${safe(request.divisionName)} (${request.number})`;
  const cell = 'border border-black px-2 py-1';

  return (
    <>
      <style>{'@page { size: A4 portrait; margin: 14mm; }'}</style>
      <PrintToolbar
        backHref={user.role === 'ADMIN' ? '/requests/history' : '/divisi/riwayat'}
        backLabel="Kembali"
        documentTitle={documentTitle}
      />

      <article style={FONT} className="relative mx-auto max-w-[210mm] bg-white p-10 shadow-lg print:max-w-none print:p-0 print:shadow-none">
        <ReportLetterhead doubleRule subtitle="IZIN OPERASIONAL : SK MENRISTEKDIKTI No. 44/KPT/I/2017" />

        <div className="mt-5 text-center">
          <h1 className="text-[14px] font-bold uppercase tracking-wide">PENGAJUAN PENGADAAN BARANG ATK</h1>
          <p className="text-[14px] font-bold uppercase tracking-wide">UNIVERSITAS TEKNOKRAT INDONESIA</p>
          <p className="mt-1 font-mono text-[10px] text-slate-600">
            {request.number} · {request.divisionName}
          </p>
        </div>

        <table className="mt-5 w-full border-collapse border border-black text-[12px]">
          <thead>
            <tr className="bg-slate-100 print:bg-slate-100">
              <th rowSpan={2} className="w-10 border border-black px-1.5 py-1.5 text-center">No.</th>
              <th rowSpan={2} className="border border-black px-2 py-1.5 text-center">Nama Barang</th>
              <th rowSpan={2} className="w-36 border border-black px-2 py-1.5 text-center">Spesifikasi</th>
              <th rowSpan={2} className="w-24 border border-black px-2 py-1.5 text-center">Kebutuhan</th>
              <th colSpan={2} className="border border-black px-2 py-1 text-center">Jumlah</th>
            </tr>
            <tr className="bg-slate-100 print:bg-slate-100">
              <th className="w-24 border border-black px-2 py-1 text-center">Pesanan</th>
              <th className="w-28 border border-black px-2 py-1 text-center">Ket.</th>
            </tr>
          </thead>
          <tbody>
            {request.items.map((item, index) => (
              <tr key={item.id}>
                <td className="border border-black px-1.5 py-1 text-center">{index + 1}</td>
                <td className={cell}>{itemName(item)}</td>
                <td className={cell}>{item.specification || ''}</td>
                <td className={`${cell} text-center`}>{item.need || ''}</td>
                <td className={`${cell} text-center`}>
                  {itemQty(item, item.approvedQuantity ?? item.quantity)}
                </td>
                <td className={cell}>{item.itemNotes || (item.noStock ? 'Tanpa stok' : '')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-2 text-[11px]">
          <span className="font-semibold">Ket :</span> Jumlah Pesanan mengikuti persetujuan admin setelah pengajuan disetujui.
        </p>
        {request.notes && <p className="mt-1 text-[11px] italic">Catatan: {request.notes}</p>}

        {/* Blok Tanda Tangan sesuai template Excel */}
        <footer className="mt-8 grid grid-cols-2 gap-10 text-[12px]">
          <div>
            <p>&nbsp;</p>
            <p>Mengetahui,</p>
            <p>Ka. Divisi,</p>
            <div className="h-16" />
            <p className="font-bold">{request.divisionHeadName || '.......................'}</p>
          </div>
          <div className="pl-6">
            <p>Bandar Lampung, {dayMonthYear(request.createdAt)}</p>
            <p>Yang Mengajukan,</p>
            <p>&nbsp;</p>
            <div className="flex h-16 items-center">
              {request.requesterSignature && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={request.requesterSignature} alt="Tanda tangan yang mengajukan" className="max-h-16 max-w-full object-contain" />
              )}
            </div>
            <p className="font-bold">{request.receiverName || request.requesterName}</p>
          </div>
        </footer>
      </article>
    </>
  );
}
