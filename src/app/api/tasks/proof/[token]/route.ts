import { NextRequest, NextResponse } from 'next/server';
import { InstallationTaskService } from '@/services/installation-task.service';

export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const task = await InstallationTaskService.getByToken(params.token);
    if (!task) return NextResponse.json({ error: 'Tugas tidak ditemukan.' }, { status: 404 });

    return NextResponse.json({
      id: task.id,
      productName: task.product.name,
      quantity: task.quantity,
      unit: task.product.unit,
      assigneeName: task.assigneeName,
      location: task.location,
      notes: task.notes,
      status: task.status,
      completedAt: task.completedAt,
      photoUrl: task.proofFileName ? `/api/tasks/proof/${params.token}/photo` : null,
    });
  } catch (error) {
    console.error('Failed to load installation task:', error);
    return NextResponse.json({ error: 'Tugas tidak dapat dimuat saat ini.' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const task = await InstallationTaskService.getByToken(params.token);
    if (!task) return NextResponse.json({ error: 'Tugas tidak ditemukan.' }, { status: 404 });
    if (task.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Bukti untuk tugas ini sudah pernah dikirim.' }, { status: 409 });
    }

    const formData = await request.formData();
    const photo = formData.get('photo');
    if (!(photo instanceof File)) {
      return NextResponse.json({ error: 'Foto bukti wajib dipilih.' }, { status: 400 });
    }

    const completedTask = await InstallationTaskService.completeWithProof(params.token, photo);
    return NextResponse.json({
      success: true,
      status: completedTask.status,
      completedAt: completedTask.completedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menyimpan bukti.';
    console.error('Failed to submit installation proof:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
