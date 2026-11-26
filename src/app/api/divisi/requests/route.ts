import { NextRequest, NextResponse } from 'next/server';
import { requireDivisi } from '@/lib/auth-server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { RequestService } from '@/services/request.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireDivisi();
    if (auth.error) return auth.error;
    return NextResponse.json(await RequestService.listMine(auth.user.id));
  } catch (error) {
    return apiError(error, 'GET /api/divisi/requests');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireDivisi();
    if (auth.error) return auth.error;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Data form tidak valid.' }, { status: 400 });
    const request = await RequestService.create(auth.user, {
      stockGroup: body.stockGroup,
      notes: body.notes,
      recipientTo: body.recipientTo,
      receiverName: body.receiverName,
      divisionHeadName: body.divisionHeadName,
      signature: body.signature,
      items: body.items,
    });
    return NextResponse.json({ success: true, request }, { status: 201 });
  } catch (error) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'POST /api/divisi/requests', req);
  }
}
