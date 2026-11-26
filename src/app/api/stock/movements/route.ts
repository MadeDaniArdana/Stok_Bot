import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { personName } from '@/lib/deleted-account';
import { InventoryService } from '@/services/inventory.service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get('productId') || undefined;
    const type = searchParams.get('type') || undefined;
    const source = searchParams.get('source') || undefined;
    const actorUserId = searchParams.get('actorUserId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;

    const where: any = {};
    if (productId && productId !== 'all') where.productId = productId;
    if (type && type !== 'all') where.type = type;
    if (source && source !== 'all') where.source = source;
    if (actorUserId && actorUserId !== 'all') where.actorUserId = actorUserId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (Number.isNaN(start.getTime())) {
          return NextResponse.json({ error: 'Format tanggal awal tidak valid.' }, { status: 400 });
        }
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (Number.isNaN(end.getTime())) {
          return NextResponse.json({ error: 'Format tanggal akhir tidak valid.' }, { status: 400 });
        }
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const exportingExcel = searchParams.get('format') === 'xlsx';
    const [total, items] = await Promise.all([
      exportingExcel ? Promise.resolve(0) : prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(exportingExcel ? {} : { skip: (page - 1) * limit, take: limit }),
        include: {
          product: {
            select: { id: true, name: true, sku: true, unit: true, packUnit: true, packSize: true },
          },
          actor: {
            select: { id: true, name: true, role: true, email: true, telegram: { select: { username: true } } },
          },
        },
      }),
    ]);

    if (exportingExcel) {
      const { excelDateWib, excelReportResponse } = await import('@/lib/excel-report');
      const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
      const period = startDate || endDate ? `${startDate || 'awal'} s.d. ${endDate || 'sekarang'}` : 'Semua tanggal';
      const activity: Record<string, string> = { IN: 'Masuk', OUT: 'Keluar', ADJUSTMENT: 'Penyesuaian', REVERSAL: 'Pembatalan' };
      return await excelReportResponse({
        filename: `riwayat-mutasi-${date.format(new Date())}`,
        sheetName: 'Riwayat Mutasi',
        title: 'Laporan Riwayat Mutasi Stok',
        period: `Periode: ${period} | Jumlah transaksi: ${items.length}`,
        columns: [
          ['No', 7], ['Waktu (WIB)', 21, 'dd/mm/yyyy hh:mm'], ['SKU', 25], ['Nama Barang', 32], ['Aktivitas', 18],
          ['Jumlah', 12], ['Satuan', 12], ['Stok Sebelum', 16], ['Stok Sesudah', 16], ['Pelaku', 22],
          ['Sumber', 13], ['Catatan', 34],
        ],
        rows: items.map((item, index) => [
          index + 1, excelDateWib(item.createdAt), item.product?.sku, item.product?.name,
          activity[item.type] ?? item.type, item.quantity, item.product?.unit, item.stockBefore, item.stockAfter,
          item.source === 'TELEGRAM' && item.actor?.telegram?.username
            ? `@${item.actor.telegram.username}`
            : personName(item.actor?.name, item.actorName, 'Sistem'),
          item.source, item.notes,
        ]),
      });
    }

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    return apiError(error, 'GET /api/stock/movements', req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { originalMovementId, reason } = await req.json();
    const result = await InventoryService.reverseMovement({
      originalMovementId,
      actorUserId: auth.user.id,
      reason,
    });

    return NextResponse.json({
      success: true,
      message: 'Transaksi koreksi pembalik berhasil dicatat.',
      data: result,
    });
  } catch (error: any) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'POST /api/stock/movements', req, 'Transaksi koreksi gagal dicatat. Detail tercatat di menu Log Error.');
  }
}
