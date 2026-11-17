import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/error-log';
import { getCurrentReportMonth, getReportMonthRange } from '@/lib/report-period';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim();
    const month = searchParams.get('month') ?? getCurrentReportMonth();
    let monthRange: ReturnType<typeof getReportMonthRange>;
    try {
      monthRange = getReportMonthRange(month);
    } catch {
      return NextResponse.json({ error: 'Bulan laporan tidak valid. Gunakan format YYYY-MM.' }, { status: 400 });
    }
    const requestedPage = Number(searchParams.get('page') ?? '1');
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
      return NextResponse.json({ error: 'Nomor halaman tidak valid.' }, { status: 400 });
    }
    const pageSize = 24;
    const where: Prisma.InstallationTaskWhereInput = {
      AND: [
        {
          OR: [
            { status: 'COMPLETED', completedAt: monthRange },
            { status: 'PENDING', createdAt: monthRange },
          ],
        },
        ...(status === 'PENDING' || status === 'COMPLETED' ? [{ status }] : []),
        ...(search ? [{
          OR: [
            { assigneeName: { contains: search, mode: 'insensitive' as const } },
            { location: { contains: search, mode: 'insensitive' as const } },
            { product: { name: { contains: search, mode: 'insensitive' as const } } },
          ],
        }] : []),
      ],
    };
    const counts = await prisma.installationTask.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const completedCount = counts.find((group) => group.status === 'COMPLETED')?._count._all || 0;
    const pendingCount = counts.find((group) => group.status === 'PENDING')?._count._all || 0;
    const total = completedCount + pendingCount;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);

    const tasks = await prisma.installationTask.findMany({
      where,
      orderBy: [{ completedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' }],
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        creator: { select: { name: true } },
      },
    });

    return NextResponse.json({
      month,
      page,
      pageSize,
      total,
      totalPages,
      completedCount,
      pendingCount,
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
