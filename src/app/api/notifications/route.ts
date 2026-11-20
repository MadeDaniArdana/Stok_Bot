import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { requireAdmin } from '@/lib/auth-server';
import { NotificationService } from '@/services/notification.service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const countOnly = new URL(req.url).searchParams.get('countOnly') === '1';
    if (countOnly) {
      const unreadCount = await NotificationService.getUnreadCount();
      return NextResponse.json({ unreadCount });
    }

    const [notifications, unreadCount] = await Promise.all([
      NotificationService.getNotifications(25),
      NotificationService.getUnreadCount(),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    return apiError(error, 'GET /api/notifications', req);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await req.json();
    if (body.all) {
      await NotificationService.markAllAsRead();
      return NextResponse.json({ success: true });
    }
    if (body.id) {
      await NotificationService.markAsRead(body.id);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 });
  } catch (error: any) {
    return apiError(error, 'PATCH /api/notifications', req);
  }
}
