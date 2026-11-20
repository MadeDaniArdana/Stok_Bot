import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { apiError } from '@/lib/error-log';
import { getStockGroup, parseStockGroup } from '@/lib/stock-groups';
import { ReportService } from '@/services/report.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  // Cegah formula injection di Excel dan escape tanda kutip.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Unduh Daftar Usulan Pengadaan Barang (habis & menipis) sebagai CSV untuk Excel. */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const rawDays = parseInt(searchParams.get('days') || '30', 10);
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 365) : 30;
    const stockGroup = parseStockGroup(searchParams.get('jenis')) ?? undefined;

    const summary = await ReportService.getDashboardSummary(days, stockGroup);
    const groupSlug = stockGroup ? getStockGroup(stockGroup).slug : 'semua';
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

    const header = [
      'No',
      'Kode SKU',
      'Nama Barang',
      'Jenis',
      'Kategori',
      'Sisa Stok',
      'Batas Minimum',
      `Pemakaian (${days} Hari)`,
      'Estimasi Usulan Beli',
      'Satuan',
      'Status',
    ];

    const lines = [header.map(csvCell).join(',')];
    summary.criticalItems.forEach((item, index) => {
      lines.push(
        [
          index + 1,
          item.sku,
          item.name,
          item.stockGroupLabel,
          item.category,
          item.currentStock,
          item.minimumStock,
          item.usedInPeriod,
          item.suggestedOrder,
          item.unit,
          item.isZero ? 'Habis' : 'Menipis',
        ]
          .map(csvCell)
          .join(',')
      );
    });

    return new NextResponse('\uFEFF' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="usulan-pengadaan-${groupSlug}-${days}hari-${today}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return apiError(error, 'GET /api/reports/export', req, 'Laporan CSV tidak dapat diunduh.');
  }
}
