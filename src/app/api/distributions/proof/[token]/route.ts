import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { DistributionService } from '@/services/distribution.service';

export const runtime = 'nodejs';

/**
 * Route publik (tanpa login) untuk link foto bukti distribusi Peralatan Listrik.
 * Akses dibatasi oleh token acak 64 karakter di URL. Respons mengikuti format link tugas
 * pemasangan agar halaman /proof yang sama bisa dipakai.
 */
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const distribution = await DistributionService.getByProofToken(params.token);
    if (!distribution || distribution.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Link foto tidak valid, sudah diganti, atau distribusinya dibatalkan.' }, { status: 404 });
    }
    const first = distribution.items[0];
    return NextResponse.json({
      productName: first?.product.name ?? '-',
      quantity: first?.quantity ?? 0,
      unit: first?.unit ?? '',
      itemsSummary: distribution.items.map((item) => `${item.product.name} - ${item.quantity} ${item.unit}`).join(', '),
      assigneeName: distribution.handoverName,
      location: distribution.recipientUnit,
      notes: distribution.notes,
      status: distribution.proofFileName ? 'COMPLETED' : 'PENDING',
      completedAt: distribution.proofUploadedAt,
      photoUrl: distribution.proofFileName ? `/api/distributions/proof/${params.token}/photo` : null,
    });
  } catch (error) {
    await logError({ source: 'UPLOAD', error, location: 'Buka link foto distribusi (GET /api/distributions/proof)' });
    return NextResponse.json({ error: 'Data distribusi tidak dapat dimuat saat ini.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  let context: Record<string, unknown> = {};
  try {
    const formData = await request.formData();
    const photo = formData.get('photo');
    if (!(photo instanceof File)) return NextResponse.json({ error: 'Foto bukti wajib dipilih.' }, { status: 400 });
    context = { foto: { jenis: photo.type, ukuranKB: Math.round(photo.size / 1024) } };

    const { uploadedAt } = await DistributionService.attachProof(params.token, photo);
    return NextResponse.json({ success: true, status: 'COMPLETED', completedAt: uploadedAt });
  } catch (error) {
    // Petugas hanya melihat pesan validasi (format foto, sudah dikirim, dll.), bukan detail database.
    const message = isUserFacingError(error) ? error.message : 'Foto gagal disimpan. Silakan coba lagi atau hubungi admin.';
    await logError({ source: 'UPLOAD', error, location: 'Upload foto distribusi (POST /api/distributions/proof)', context });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
