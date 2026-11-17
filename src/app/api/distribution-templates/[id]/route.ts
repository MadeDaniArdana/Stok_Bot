import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { DistributionTemplateService } from '@/services/distribution-template.service';

/** Perbarui isi paket (barang & jumlah) dengan tabel terbaru dari form. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const template = await DistributionTemplateService.update(params.id, body);
    return NextResponse.json({ success: true, template });
  } catch (error) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'PUT /api/distribution-templates/[id]', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await DistributionTemplateService.remove(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'DELETE /api/distribution-templates/[id]', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}
