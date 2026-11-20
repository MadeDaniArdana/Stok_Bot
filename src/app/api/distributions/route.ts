import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/auth-server';
import { getCurrentReportMonth } from '@/lib/report-period';
import { parseStockGroup } from '@/lib/stock-groups';
import { DistributionService } from '@/services/distribution.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const stockGroup = parseStockGroup(searchParams.get('jenis'));
    if (!stockGroup) return NextResponse.json({ error: 'Jenis stok tidak valid.' }, { status: 400 });

    const month = searchParams.get('month') || getCurrentReportMonth();
    if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json({ error: 'Bulan laporan tidak valid. Gunakan format YYYY-MM.' }, { status: 400 });
    }
    const status = searchParams.get('status');
    const page = Number(searchParams.get('page') || '1');
    const rawPageSize = Number(searchParams.get('pageSize') || '20');
    const pageSize = Number.isFinite(rawPageSize) ? Math.min(Math.max(Math.trunc(rawPageSize), 1), 100) : 20;

    const result = await DistributionService.list({
      stockGroup,
      month,
      search: searchParams.get('search') || undefined,
      status: status === 'COMPLETED' || status === 'CANCELLED' ? status : 'all',
      page: Number.isSafeInteger(page) && page > 0 ? page : 1,
      pageSize,
    });
    return NextResponse.json({ month, ...result });
  } catch (error) {
    return apiError(error, 'GET /api/distributions', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Data form tidak valid.' }, { status: 400 });
  }

  try {
    const { distribution, proofToken } = await DistributionService.create({
      stockGroup: body.stockGroup,
      recipientUnit: body.recipientUnit,
      orderNumber: body.orderNumber,
      date: body.date,
      storageLocation: body.storageLocation,
      receiverName: body.receiverName,
      officerPhone: body.officerPhone,
      handoverName: body.handoverName,
      notes: body.notes,
      items: body.items,
      actorUserId: auth.user.id,
    });
    return NextResponse.json({ success: true, distribution, proofToken }, { status: 201 });
  } catch (error: any) {
    // Pesan validasi (stok kurang, field kosong) ditampilkan apa adanya ke admin.
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return apiError(error, 'POST /api/distributions', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}
