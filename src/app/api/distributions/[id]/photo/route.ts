import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-log';
import { prisma } from '@/lib/prisma';
import { readTaskProof } from '@/lib/task-proof-storage';
import { proofResponse } from '@/lib/proof-response';

export const runtime = 'nodejs';

/** Foto bukti distribusi untuk admin (butuh login, dilindungi middleware). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const distribution = await prisma.distribution.findUnique({
      where: { id: params.id },
      select: { proofFileName: true, proofMimeType: true, proofs: { select: { location: true, fileName: true, mimeType: true } } },
    });
    const proof = distribution?.proofs.find((p) => p.location === request.nextUrl.searchParams.get('location'));
    const fileName = proof?.fileName ?? distribution?.proofFileName;
    const mimeType = proof?.mimeType ?? distribution?.proofMimeType;
    if (!fileName || !mimeType) {
      return NextResponse.json({ error: 'Foto bukti belum dikirim.' }, { status: 404 });
    }
    const photo = await readTaskProof(fileName);
    if (!photo) return NextResponse.json({ error: 'File foto tidak ditemukan.' }, { status: 404 });
    return proofResponse(request, photo, mimeType, 'private, max-age=86400');
  } catch (error) {
    await logError({ source: 'UPLOAD', error, location: 'GET /api/distributions/[id]/photo', context: { distribusiId: params.id } });
    return NextResponse.json({ error: 'Foto bukti tidak dapat dimuat.' }, { status: 500 });
  }
}
