import { NextRequest, NextResponse } from 'next/server';
import { InstallationTaskService } from '@/services/installation-task.service';
import { logError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';

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
    await logError({ source: 'UPLOAD', error, location: 'Buka link bukti (GET /api/tasks/proof)' });
    return NextResponse.json({ error: 'Tugas tidak dapat dimuat saat ini.' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  let logContext: Record<string, unknown> = {};
  try {
    const task = await InstallationTaskService.getByToken(params.token);
    if (task) {
      logContext = {
        tugasId: task.id,
        barang: task.product.name,
        jumlah: task.quantity,
        pemasang: task.assigneeName,
        lokasi: task.location,
      };
    }
    if (!task) return NextResponse.json({ error: 'Tugas tidak ditemukan.' }, { status: 404 });
    if (task.status === 'COMPLETED') {
      return NextResponse.json({ error: 'Bukti untuk tugas ini sudah pernah dikirim.' }, { status: 409 });
    }

    const formData = await request.formData();
    const photo = formData.get('photo');
    if (!(photo instanceof File)) {
      return NextResponse.json({ error: 'Foto bukti wajib dipilih.' }, { status: 400 });
    }

    logContext = { ...logContext, foto: { jenis: photo.type, ukuranKB: Math.round(photo.size / 1024) } };
    const completedTask = await InstallationTaskService.completeWithProof(params.token, photo);
    return NextResponse.json({
      success: true,
      status: completedTask.status,
      completedAt: completedTask.completedAt,
    });
  } catch (error) {
    const message = isUserFacingError(error) ? error.message : 'Gagal menyimpan bukti. Silakan coba lagi atau hubungi admin.';
    await logError({ source: 'UPLOAD', error, location: 'Upload foto bukti (POST /api/tasks/proof)', context: logContext });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
