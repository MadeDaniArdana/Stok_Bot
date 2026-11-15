import { NextRequest, NextResponse } from 'next/server';
import { TelegramService } from '@/services/telegram.service';

export async function POST(req: NextRequest) {
  try {
    // Verifikasi secret token jika diset
    const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (expectedSecret && secretHeader && secretHeader !== expectedSecret) {
      return NextResponse.json({ error: 'Akses Ditolak: Secret token tidak cocok' }, { status: 401 });
    }

    const payload = await req.json();

    if (!payload || !payload.update_id) {
      return NextResponse.json({ error: 'Invalid payload: update_id missing' }, { status: 400 });
    }

    const result = await TelegramService.handleWebhookUpdate(payload);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
