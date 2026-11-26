import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { apiError } from '@/lib/error-log';
import { resolveSummaryPeriod } from '@/lib/report-period';
import { getStockGroup, parseStockGroup } from '@/lib/stock-groups';
import { ReportService } from '@/services/report.service';

import { excelReportResponse } from '@/lib/excel-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Unduh Daftar Usulan Pengadaan Barang (habis & menipis) per bulan (?periode=YYYY-MM) atau tahun (?periode=YYYY):
 * Stok Sisa (awal periode) + Stok Masuk (selama periode) = Jumlah Stok.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const period = resolveSummaryPeriod(searchParams.get('periode'), searchParams.get('days'));
    const stockGroup = parseStockGroup(searchParams.get('jenis')) ?? undefined;

    const summary = await ReportService.getProcurementReport(period, stockGroup);
    const groupSlug = stockGroup ? getStockGroup(stockGroup).slug : 'semua';
    const periodSlug =
      summary.period.kind === 'year'
        ? `tahun-${summary.period.value}`
        : summary.period.kind === 'month'
          ? `bulan-${summary.period.value}`
          : `${summary.days}hari`;

    return await excelReportResponse({
      filename: `usulan-pengadaan-${groupSlug}-${periodSlug}`,
      sheetName: 'Usulan Pengadaan',
      title: 'Daftar Usulan Pengadaan Barang',
      period: `Periode: ${summary.period.label} | Jenis stok: ${stockGroup ? getStockGroup(stockGroup).label : 'Semua Jenis'}`,
      columns: [
        ['No', 7], ['Kode SKU', 26], ['Nama Barang', 36], ['Jenis', 20],
        [`Stok Sisa (${summary.period.openingLabel})`, 25], ['Stok Masuk', 14], ['Jumlah Stok', 15], ['Satuan', 12],
      ],
      rows: summary.criticalItems.map((item, index) => [
        index + 1, item.sku, item.name, item.stockGroupLabel, item.remainingStock, item.incomingStock, item.totalStock, item.unit,
      ]),
    });
  } catch (error) {
    return apiError(error, 'GET /api/reports/export', req, 'Laporan Excel tidak dapat diunduh.');
  }
}
