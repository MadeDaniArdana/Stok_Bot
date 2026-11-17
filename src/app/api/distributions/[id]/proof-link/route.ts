import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { DistributionService } from '@/services/distribution.service';

export const runtime = 'nodejs';

/** Buat ulang link foto bukti (link lama otomatis tidak berlaku). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = await DistributionService.regenerateProofLink(params.id);
    return NextResponse.json({ success: true, token });
  } catch (error) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'POST /api/distributions/[id]/proof-link', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}
