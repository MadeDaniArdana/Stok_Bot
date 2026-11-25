import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/auth-server';
import { DistributionService } from '@/services/distribution.service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { id } = await params;

    const { reason } = await req.json().catch(() => ({ reason: '' }));
    await DistributionService.cancel(id, String(reason || ''), auth.user.id);
    return NextResponse.json({ success: true, message: 'Distribusi dibatalkan dan stok telah dikembalikan.' });
  } catch (error: any) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return apiError(error, 'POST /api/distributions/[id]/cancel', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}
