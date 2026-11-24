import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { apiError } from '@/lib/error-log';
import { RequestService } from '@/services/request.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const view = new URL(req.url).searchParams.get('view') === 'history' ? 'history' : 'incoming';
    return NextResponse.json(await RequestService.list(view));
  } catch (error) {
    return apiError(error, 'GET /api/requests', req);
  }
}
