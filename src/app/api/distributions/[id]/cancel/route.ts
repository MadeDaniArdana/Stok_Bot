import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { getCurrentUser } from '@/lib/auth-server';
import { DistributionService } from '@/services/distribution.service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { reason } = await req.json().catch(() => ({ reason: '' }));
    const user = await getCurrentUser();
    await DistributionService.cancel(params.id, String(reason || ''), user?.id);
    return NextResponse.json({ success: true, message: 'Distribusi dibatalkan dan stok telah dikembalikan.' });
  } catch (error: any) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return apiError(error, 'POST /api/distributions/[id]/cancel', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}
