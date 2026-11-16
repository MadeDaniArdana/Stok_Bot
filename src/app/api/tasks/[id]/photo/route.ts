import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { readTaskProof } from '@/lib/task-proof-storage';
import { logError } from '@/lib/error-log';

export const runtime = 'nodejs';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const task = await prisma.installationTask.findUnique({
      where: { id: params.id },
      select: { proofFileName: true, proofMimeType: true },
    });
    if (!task?.proofFileName || !task.proofMimeType) {
      return NextResponse.json({ error: 'Foto bukti tidak ditemukan.' }, { status: 404 });
    }

    const photo = await readTaskProof(task.proofFileName);
    if (!photo) return NextResponse.json({ error: 'File foto tidak ditemukan.' }, { status: 404 });

    return new NextResponse(new Uint8Array(photo), {
      headers: {
        'Content-Type': task.proofMimeType,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    await logError({ source: 'UPLOAD', error, location: 'GET /api/tasks/[id]/photo', context: { tugasId: params.id } });
    return NextResponse.json({ error: 'Foto bukti tidak dapat dimuat.' }, { status: 500 });
  }
}
