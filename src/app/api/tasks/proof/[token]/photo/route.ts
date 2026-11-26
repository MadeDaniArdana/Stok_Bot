import { NextRequest, NextResponse } from 'next/server';
import { readTaskProof } from '@/lib/task-proof-storage';
import { logError } from '@/lib/error-log';
import { InstallationTaskService } from '@/services/installation-task.service';

import { verifyProofPhotoLink } from '@/lib/proof-photo-link';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!verifyProofPhotoLink(`/api/tasks/proof/${token}/photo`, request.nextUrl.searchParams)) {
      return NextResponse.json({ error: 'Tautan foto sudah kedaluwarsa atau tidak valid. Muat ulang halaman bukti.' }, { status: 404 });
    }
    const task = await InstallationTaskService.getByToken(token);
    if (!task?.proofFileName || !task.proofMimeType) {
      return NextResponse.json({ error: 'Foto bukti tidak ditemukan.' }, { status: 404 });
    }

    const photo = await readTaskProof(task.proofFileName);
    if (!photo) return NextResponse.json({ error: 'File foto tidak ditemukan.' }, { status: 404 });

    return new NextResponse(new Uint8Array(photo), {
      headers: {
        'Content-Type': task.proofMimeType,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    await logError({ source: 'UPLOAD', error, location: 'GET /api/tasks/proof/[token]/photo' });
    return NextResponse.json({ error: 'Foto bukti tidak dapat dimuat.' }, { status: 500 });
  }
}
