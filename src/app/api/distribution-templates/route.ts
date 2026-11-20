import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/auth-server';
import { parseStockGroup } from '@/lib/stock-groups';
import { DistributionTemplateService } from '@/services/distribution-template.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const stockGroup = parseStockGroup(new URL(req.url).searchParams.get('jenis'));
    if (!stockGroup) return NextResponse.json({ error: 'Jenis stok tidak valid.' }, { status: 400 });
    return NextResponse.json({ templates: await DistributionTemplateService.list(stockGroup) });
  } catch (error) {
    return apiError(error, 'GET /api/distribution-templates', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await req.json();
    const template = await DistributionTemplateService.create(body);
    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'POST /api/distribution-templates', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}
