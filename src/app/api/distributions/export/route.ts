import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { prisma } from '@/lib/prisma';
import { getReportMonthRange } from '@/lib/report-period';
import { getStockGroup, parseStockGroup } from '@/lib/stock-groups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  // Cegah formula injection di Excel dan escape tanda kutip.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Unduh riwayat distribusi satu bulan sebagai CSV (satu baris per barang). */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stockGroup = parseStockGroup(searchParams.get('jenis'));
    const month = searchParams.get('month') || '';
    if (!stockGroup) return NextResponse.json({ error: 'Jenis stok tidak valid.' }, { status: 400 });
    let range;
    try {
      range = getReportMonthRange(month);
    } catch {
      return NextResponse.json({ error: 'Bulan tidak valid. Gunakan format YYYY-MM.' }, { status: 400 });
    }

    const group = getStockGroup(stockGroup);
    const rows = await prisma.distribution.findMany({
      where: { stockGroup, distributedAt: range },
      orderBy: [{ distributedAt: 'asc' }, { createdAt: 'asc' }],
      include: { items: { include: { product: { select: { name: true, sku: true } } }, orderBy: { id: 'asc' } } },
    });

    const header = ['Tanggal', 'No. Dokumen', group.recipientLabel, 'No. Nota Pesanan', 'SKU', 'Nama Barang', 'Jumlah', 'Satuan', 'Tempat Penyimpanan', 'Penerima', group.handoverLabel, 'Status', 'Catatan'];
    const lines = [header.map(csvCell).join(',')];
    for (const row of rows) {
      const date = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'short' }).format(row.distributedAt);
      for (const item of row.items) {
        lines.push(
          [
            date,
            row.number,
            row.recipientUnit,
            row.orderNumber,
            item.product.sku,
            item.product.name,
            item.quantity,
            item.unit,
            row.storageLocation,
            row.receiverName,
            row.handoverName,
            row.status === 'CANCELLED' ? 'Dibatalkan' : 'Selesai',
            row.status === 'CANCELLED' ? row.cancelReason : row.notes,
          ]
            .map(csvCell)
            .join(',')
        );
      }
    }

    // BOM agar Excel membaca UTF-8 dengan benar; pemisah ";" tidak dipakai supaya tetap CSV standar.
    return new NextResponse('\uFEFF' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="distribusi-${group.slug}-${month}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return apiError(error, 'GET /api/distributions/export', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}
