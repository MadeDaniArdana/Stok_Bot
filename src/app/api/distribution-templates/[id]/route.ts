import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/auth-server';
import { DistributionTemplateService } from '@/services/distribution-template.service';

/** Perbarui isi paket (barang & jumlah) dengan tabel terbaru dari form. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { id } = await params;

    const body = await req.json();
    const template = await DistributionTemplateService.update(id, body);
    return NextResponse.json({ success: true, template });
  } catch (error) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'PUT /api/distribution-templates/[id]', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { id } = await params;

    const replacementId = req.nextUrl.searchParams.get('replacementId') || undefined;
    const { accounts } = await DistributionTemplateService.remove(id, replacementId);
    if (accounts.length && !replacementId) {
      return NextResponse.json({ error: 'Pilih paket pengganti untuk akun yang memakai paket ini.', accounts }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'DELETE /api/distribution-templates/[id]', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}
