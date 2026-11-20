import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { apiError } from '@/lib/error-log';
import { prisma } from '@/lib/prisma';

// Tanpa ini Next.js menjadikan route statis: datanya dibekukan saat build.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const [recentUpdates, totalUpdates, failedUpdates, linkedCount] = await Promise.all([
      prisma.telegramUpdate.findMany({
        orderBy: { receivedAt: 'desc' },
        take: 10,
      }),
      prisma.telegramUpdate.count(),
      prisma.telegramUpdate.count({ where: { status: 'FAILED' } }),
      prisma.telegramUser.count({ where: { isActive: true } }),
    ]);

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'stockflow_inventory_bot';
    const isConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN);

    return NextResponse.json({
      botUsername,
      isConfigured,
      webhookStatus: 'ACTIVE',
      webhookUrl: `${process.env.APP_URL || 'http://localhost:3000'}/api/telegram/webhook`,
      totalUpdates,
      failedUpdates,
      linkedCount,
      recentUpdates,
    });
  } catch (error: any) {
    return apiError(error, 'GET /api/telegram/status');
  }
}
