import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { DistributionService } from '@/services/distribution.service';
import { formatItemQuantity } from '@/lib/product-units';

import { createProofPhotoLink } from '@/lib/proof-photo-link';

export const runtime = 'nodejs';

/**
 * Route publik (tanpa login) untuk link foto bukti distribusi Peralatan Listrik.
 * Akses dibatasi oleh token acak 64 karakter di URL. Respons mengikuti format link tugas
 * pemasangan agar halaman /proof yang sama bisa dipakai.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const distribution = await DistributionService.getByProofToken(token);
    if (!distribution || distribution.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Link foto tidak valid, sudah diganti, atau distribusinya dibatalkan.' }, { status: 404 });
    }
    const first = distribution.items[0];
    // Daftar lokasi pemasangan; tiap lokasi punya foto sendiri. Dokumen lama (foto di level dokumen) dianggap satu lokasi.
    const base = `/api/distributions/proof/${token}/photo`;
    const locations = DistributionService.locationsOf(distribution).map((location) => {
      const proof = distribution.proofs.find((p) => p.location === location);
      const legacy = Boolean(distribution.proofFileName) && distribution.proofs.length === 0;
      return {
        location,
        items: distribution.items
          .filter((item) => (item.location || distribution.recipientUnit) === location)
          .map((item) => `${item.product.name} - ${formatItemQuantity(item.quantity, item.unit, item.product)}`)
          .join(', '),
        done: Boolean(proof) || legacy,
        photoUrl: proof || legacy ? createProofPhotoLink(base, location) : null,
      };
    });
    const multi = locations.length > 1;
    return NextResponse.json({
      locations,
      productName: first?.product.name ?? '-',
      quantity: first?.quantity ?? 0,
      unit: first?.unit ?? '',
      itemsSummary: distribution.items.map((item) => `${item.product.name} - ${formatItemQuantity(item.quantity, item.unit, item.product)}`).join(', '),
      assigneeName: distribution.handoverName,
      location: distribution.recipientUnit,
      notes: distribution.notes,
      status: distribution.proofFileName ? 'COMPLETED' : 'PENDING',
      completedAt: distribution.proofUploadedAt,
      photoUrl: !multi && distribution.proofFileName ? createProofPhotoLink(base) : null,
    });
  } catch (error) {
    await logError({ source: 'UPLOAD', error, location: 'Buka link foto distribusi (GET /api/distributions/proof)' });
    return NextResponse.json({ error: 'Data distribusi tidak dapat dimuat saat ini.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  let context: Record<string, unknown> = {};
  try {
    const { token } = await params;
    const formData = await request.formData();
    const photo = formData.get('photo');
    if (!(photo instanceof File)) return NextResponse.json({ error: 'Foto bukti wajib dipilih.' }, { status: 400 });
    context = { foto: { jenis: photo.type, ukuranKB: Math.round(photo.size / 1024) } };

    const location = formData.get('location');
    const { uploadedAt, completed, location: savedLocation } = await DistributionService.attachProof(
      token,
      photo,
      typeof location === 'string' ? location : null
    );
    return NextResponse.json({
      success: true,
      status: completed ? 'COMPLETED' : 'PENDING',
      completedAt: uploadedAt,
      location: savedLocation,
      photoUrl: createProofPhotoLink(`/api/distributions/proof/${token}/photo`, savedLocation),
    });
  } catch (error) {
    // Petugas hanya melihat pesan validasi (format foto, sudah dikirim, dll.), bukan detail database.
    const message = isUserFacingError(error) ? error.message : 'Foto gagal disimpan. Silakan coba lagi atau hubungi admin.';
    await logError({ source: 'UPLOAD', error, location: 'Upload foto distribusi (POST /api/distributions/proof)', context });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
