import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { apiError } from '@/lib/error-log';
import { resolveSummaryPeriod } from '@/lib/report-period';
import { getStockGroup, parseStockGroup } from '@/lib/stock-groups';
import { ReportService } from '@/services/report.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  // Cegah formula injection di Excel (angka negatif tetap dibiarkan) dan escape tanda kutip.
  const safe = /^[=+@]/.test(text) || /^-(?!\d)/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

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

    const summary = await ReportService.getDashboardSummary(period, stockGroup);
    const groupSlug = stockGroup ? getStockGroup(stockGroup).slug : 'semua';
    const periodSlug =
      summary.period.kind === 'year'
        ? `tahun-${summary.period.value}`
        : summary.period.kind === 'month'
          ? `bulan-${summary.period.value}`
          : `${summary.days}hari`;

    const lines = [
      [`Daftar Usulan Pengadaan Barang - ${summary.period.label}`].map(csvCell).join(','),
      [`Jenis Stok: ${stockGroup ? getStockGroup(stockGroup).label : 'Semua Jenis'}`].map(csvCell).join(','),
      '',
      ['No', 'Kode SKU', 'Nama Barang', 'Jenis', `Stok Sisa (${summary.period.openingLabel})`, 'Stok Masuk', 'Jumlah Stok', 'Satuan']
        .map(csvCell)
        .join(','),
    ];
    summary.criticalItems.forEach((item, index) => {
      lines.push(
        [index + 1, item.sku, item.name, item.stockGroupLabel, item.remainingStock, item.incomingStock, item.totalStock, item.unit]
          .map(csvCell)
          .join(',')
      );
    });

    return new NextResponse('﻿' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="usulan-pengadaan-${groupSlug}-${periodSlug}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return apiError(error, 'GET /api/reports/export', req, 'Laporan CSV tidak dapat diunduh.');
  }
}
