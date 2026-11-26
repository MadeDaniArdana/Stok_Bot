import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { readTaskProof } from '@/lib/task-proof-storage';
import { proofResponse } from '@/lib/proof-response';
import { logError } from '@/lib/error-log';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const task = await prisma.installationTask.findUnique({
      where: { id },
      select: { proofFileName: true, proofMimeType: true },
    });
    if (!task?.proofFileName || !task.proofMimeType) {
      return NextResponse.json({ error: 'Foto bukti tidak ditemukan.' }, { status: 404 });
    }

    const photo = await readTaskProof(task.proofFileName);
    if (!photo) return NextResponse.json({ error: 'File foto tidak ditemukan.' }, { status: 404 });

    return proofResponse(request, photo, task.proofMimeType, 'private, no-store');
  } catch (error) {
    await logError({ source: 'UPLOAD', error, location: 'GET /api/tasks/[id]/photo', context: { tugasId: id } });
    return NextResponse.json({ error: 'Foto bukti tidak dapat dimuat.' }, { status: 500 });
  }
}
