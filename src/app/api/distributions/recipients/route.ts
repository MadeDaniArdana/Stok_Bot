import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { parseStockGroup } from '@/lib/stock-groups';
import { DistributionService } from '@/services/distribution.service';

export const dynamic = 'force-dynamic';

/** Unit/ruang tujuan yang pernah dipakai, untuk saran isian di form distribusi. */
export async function GET(req: NextRequest) {
  try {
    const stockGroup = parseStockGroup(new URL(req.url).searchParams.get('jenis'));
    if (!stockGroup) return NextResponse.json({ error: 'Jenis stok tidak valid.' }, { status: 400 });
    return NextResponse.json({ recipients: await DistributionService.recentRecipients(stockGroup) });
  } catch (error) {
    return apiError(error, 'GET /api/distributions/recipients', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}
