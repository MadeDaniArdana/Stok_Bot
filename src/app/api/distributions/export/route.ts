import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { requireAdmin } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { getReportMonthRange, parseStockReportPeriod } from '@/lib/report-period';
import { getStockGroup, parseStockGroup } from '@/lib/stock-groups';

import { excelDateWib, excelReportResponse } from '@/lib/excel-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Unduh riwayat distribusi satu bulan sebagai Excel (satu baris per barang). */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

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
      where: { stockGroup, distributedAt: range, status: 'COMPLETED' },
      orderBy: [{ distributedAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        distributedAt: true, recipientUnit: true, handoverName: true, receiverName: true,
        number: true, orderNumber: true, storageLocation: true, notes: true,
        items: {
          orderBy: { id: 'asc' },
          select: { location: true, quantity: true, unit: true, product: { select: { name: true, sku: true } } },
        },
      },
    });

    const isListrik = stockGroup === 'LISTRIK';
    return await excelReportResponse({
      filename: `distribusi-${group.slug}-${month}`,
      sheetName: 'Rincian Distribusi',
      title: `Laporan Distribusi ${group.label}`,
      period: `Periode: ${parseStockReportPeriod(month).label}`,
      columns: [
        ['No', 7], ['Tanggal', 15], [isListrik ? 'Ruang' : 'Kepada', 25],
        ['Nama Barang', 36], ['Jumlah', 12], ['Satuan', 12], [isListrik ? 'Nama' : 'Penerima', 24],
        ['No. Dokumen', 21], ['No. Nota Pesanan', 21], ['SKU', 24],
        ['Tempat Penyimpanan', 23], ['Catatan', 32],
      ],
      rows: (function* () {
        let index = 0;
        for (const row of rows) {
          const date = excelDateWib(row.distributedAt);
          const recipient = isListrik ? row.handoverName : row.receiverName;
          for (const item of row.items) {
            yield [
              ++index, date, isListrik ? item.location || row.recipientUnit : row.recipientUnit,
              item.product.name, item.quantity, item.unit, recipient,
              row.number, row.orderNumber, item.product.sku, row.storageLocation, row.notes,
            ];
          }
        }
      })(),
    });
  } catch (error) {
    return apiError(error, 'GET /api/distributions/export', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}
