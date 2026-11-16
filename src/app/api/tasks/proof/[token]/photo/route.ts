import { NextRequest, NextResponse } from 'next/server';
import { readTaskProof } from '@/lib/task-proof-storage';
import { InstallationTaskService } from '@/services/installation-task.service';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const task = await InstallationTaskService.getByToken(params.token);
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
    console.error('Failed to load task proof photo:', error);
    return NextResponse.json({ error: 'Foto bukti tidak dapat dimuat.' }, { status: 500 });
  }
}
