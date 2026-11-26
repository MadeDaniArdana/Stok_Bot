import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { apiError } from '@/lib/error-log';
import { parseStockReportPeriod } from '@/lib/report-period';
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
 * Riwayat posisi stok per bulan (?periode=YYYY-MM) atau per tahun (?periode=YYYY):
 * stok lama, stok baru (masuk), total, keluar, dan sisa akhir. Tambahkan ?format=csv untuk unduh Excel.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const period = parseStockReportPeriod(searchParams.get('periode'));
    const stockGroup = parseStockGroup(searchParams.get('jenis')) ?? undefined;
    const report = await ReportService.getStockPositionReport(period, stockGroup);

    if (searchParams.get('format') !== 'csv') return NextResponse.json(report);

    const header = [
      'No',
      'Kode SKU',
      'Nama Barang',
      'Jenis',
      'Kategori',
      'Satuan',
      `Stok Awal (${period.openingLabel})`,
      'Barang Masuk',
      'Total (Awal + Masuk)',
      'Keluar',
      ...(report.hasAdjustment ? ['Penyesuaian'] : []),
      'Sisa Akhir',
    ];
    const lines = [
      [`Riwayat Stok ${period.label}`].map(csvCell).join(','),
      [`Jenis Stok: ${stockGroup ? getStockGroup(stockGroup).label : 'Semua Jenis'}`].map(csvCell).join(','),
      '',
      header.map(csvCell).join(','),
    ];
    report.rows.forEach((row, index) => {
      lines.push(
        [
          index + 1,
          row.sku,
          row.name,
          row.stockGroupLabel,
          row.category,
          row.unit,
          row.openingStock,
          row.inQty,
          row.totalAvailable,
          row.outQty,
          ...(report.hasAdjustment ? [row.adjustment] : []),
          row.closingStock,
        ]
          .map(csvCell)
          .join(',')
      );
    });
    for (const t of report.totalsByUnit) {
      lines.push(
        ['', '', `SUBTOTAL (${t.itemCount} jenis barang)`, '', '', t.unit, t.openingStock, t.inQty,
          t.totalAvailable, t.outQty, ...(report.hasAdjustment ? [t.adjustment] : []), t.closingStock]
          .map(csvCell)
          .join(',')
      );
    }

    const groupSlug = stockGroup ? getStockGroup(stockGroup).slug : 'semua';
    const fileLabel = period.kind === 'year' ? `tahun-${period.value}` : `bulan-${period.value}`;
    return new NextResponse('\uFEFF' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="riwayat-stok-${groupSlug}-${fileLabel}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return apiError(error, 'GET /api/reports/stock-position', req, 'Riwayat stok tidak dapat dimuat.');
  }
}
