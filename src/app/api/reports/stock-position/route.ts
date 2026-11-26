import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { apiError } from '@/lib/error-log';
import { parseStockReportPeriod } from '@/lib/report-period';
import { getStockGroup, parseStockGroup } from '@/lib/stock-groups';
import { ReportService } from '@/services/report.service';

import { excelReportResponse } from '@/lib/excel-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Riwayat posisi stok per bulan (?periode=YYYY-MM) atau per tahun (?periode=YYYY):
 * stok lama, stok baru (masuk), total, keluar, dan sisa akhir. Tambahkan ?format=xlsx untuk unduh Excel.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const period = parseStockReportPeriod(searchParams.get('periode'));
    const stockGroup = parseStockGroup(searchParams.get('jenis')) ?? undefined;
    const report = await ReportService.getStockPositionReport(period, stockGroup);

    if (searchParams.get('format') !== 'xlsx') return NextResponse.json(report);

    const groupSlug = stockGroup ? getStockGroup(stockGroup).slug : 'semua';
    const fileLabel = period.kind === 'year' ? `tahun-${period.value}` : `bulan-${period.value}`;
    return await excelReportResponse({
      filename: `riwayat-stok-${groupSlug}-${fileLabel}`,
      sheetName: 'Posisi Stok',
      title: 'Laporan Posisi Stok',
      period: `Periode: ${period.label} | Jenis stok: ${stockGroup ? getStockGroup(stockGroup).label : 'Semua Jenis'}`,
      columns: [
        ['No', 7], ['Kode SKU', 26], ['Nama Barang', 36], ['Jenis', 19], ['Kategori', 23], ['Satuan', 12],
        [`Stok Awal (${period.openingLabel})`, 25], ['Barang Masuk', 15], ['Total (Awal + Masuk)', 19], ['Keluar', 12],
        ...(report.hasAdjustment ? [['Penyesuaian', 15] as [string, number]] : []), ['Sisa Akhir', 13],
      ],
      rows: report.rows.map((row, index) => [
        index + 1, row.sku, row.name, row.stockGroupLabel, row.category, row.unit, row.openingStock,
        row.inQty, row.totalAvailable, row.outQty, ...(report.hasAdjustment ? [row.adjustment] : []), row.closingStock,
      ]),
      subtotals: report.totalsByUnit.map((row) => [
        null, null, `Subtotal (${row.itemCount} jenis barang)`, null, null, row.unit, row.openingStock,
        row.inQty, row.totalAvailable, row.outQty, ...(report.hasAdjustment ? [row.adjustment] : []), row.closingStock,
      ]),
    });
  } catch (error) {
    return apiError(error, 'GET /api/reports/stock-position', req, 'Riwayat stok tidak dapat dimuat.');
  }
}
