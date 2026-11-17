import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-log';
import { readTaskProof } from '@/lib/task-proof-storage';
import { DistributionService } from '@/services/distribution.service';

export const runtime = 'nodejs';

/** Foto bukti untuk pemegang link (petugas melihat foto yang sudah dikirim). */
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const distribution = await DistributionService.getByProofToken(params.token);
    if (!distribution?.proofFileName || !distribution.proofMimeType) {
      return NextResponse.json({ error: 'Foto bukti tidak ditemukan.' }, { status: 404 });
    }
    const photo = await readTaskProof(distribution.proofFileName);
    if (!photo) return NextResponse.json({ error: 'File foto tidak ditemukan.' }, { status: 404 });
    return new NextResponse(new Uint8Array(photo), {
      headers: { 'Content-Type': distribution.proofMimeType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    await logError({ source: 'UPLOAD', error, location: 'GET /api/distributions/proof/[token]/photo' });
    return NextResponse.json({ error: 'Foto bukti tidak dapat dimuat.' }, { status: 500 });
  }
}
