import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { RequestService } from '@/services/request.service';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const request = await RequestService.approve(id, auth.user, {
      items: body?.items,
      date: body?.date,
      recipientUnit: body?.recipientUnit,
      storageLocation: body?.storageLocation,
      adminSignature: body?.adminSignature,
    });
    return NextResponse.json({ success: true, request });
  } catch (error) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'POST /api/requests/[id]/approve', req);
  }
}
