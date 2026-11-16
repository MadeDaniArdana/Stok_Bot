import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/error-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim();

    const tasks = await prisma.installationTask.findMany({
      where: {
        ...(status === 'PENDING' || status === 'COMPLETED' ? { status } : {}),
        ...(search
          ? {
              OR: [
                { assigneeName: { contains: search, mode: 'insensitive' } },
                { location: { contains: search, mode: 'insensitive' } },
                { product: { name: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        creator: { select: { name: true } },
      },
    });

    return NextResponse.json({
      items: tasks.map((task) => ({
        id: task.id,
        productName: task.product.name,
        sku: task.product.sku,
        unit: task.product.unit,
        quantity: task.quantity,
        assigneeName: task.assigneeName,
        location: task.location,
        notes: task.notes,
        status: task.status,
        creatorName: task.creator.name,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        photoUrl: task.proofFileName ? `/api/tasks/${task.id}/photo` : null,
      })),
    });
  } catch (error) {
    return apiError(error, 'GET /api/tasks', req, 'Daftar tugas tidak dapat dimuat.');
  }
}
