import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/error-log';

export const dynamic = 'force-dynamic';

/** Ringkasan ringan pengajuan yang menunggu, dipolling admin untuk pop-up pengingat. */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const where = { status: 'PENDING' };
    const [count, latest] = await Promise.all([
      prisma.itemRequest.count({ where }),
      prisma.itemRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, number: true, divisionName: true, _count: { select: { items: true } } },
      }),
    ]);
    return NextResponse.json({
      count,
      latest: latest.map((r) => ({ id: r.id, number: r.number, divisionName: r.divisionName, itemCount: r._count.items })),
    });
  } catch (error) {
    return apiError(error, 'GET /api/requests/pending');
  }
}
