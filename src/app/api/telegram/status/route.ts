import { NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
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
