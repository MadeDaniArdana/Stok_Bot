import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notification.service';
import { apiError } from '@/lib/error-log';

export const dynamic = 'force-dynamic';

/**
 * Endpoint polling tunggal ringan untuk admin (menggabungkan jumlah notifikasi belum dibaca
 * dan ringkasan pengajuan menunggu dalam 1 HTTP request & 1 pemeriksaan sesi).
 */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const where = { status: 'PENDING' };
    const [unreadCount, pendingCount, latest] = await Promise.all([
      NotificationService.getUnreadCount(),
      prisma.itemRequest.count({ where }),
      prisma.itemRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, number: true, divisionName: true, _count: { select: { items: true } } },
      }),
    ]);

    return NextResponse.json(
      {
        unreadCount,
        pendingRequests: {
          count: pendingCount,
          latest: latest.map((r) => ({
            id: r.id,
            number: r.number,
            divisionName: r.divisionName,
            itemCount: r._count.items,
          })),
        },
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return apiError(error, 'GET /api/admin/pulse');
  }
}
