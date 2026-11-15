import { NextRequest, NextResponse } from 'next/server';
import { TelegramService } from '@/services/telegram.service';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { text, telegramUserId = '78291044', username = 'sitirahma_ops', updateId } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Teks pesan tidak boleh kosong' }, { status: 400 });
    }

    const effectiveUpdateId = updateId || `sim-${Date.now()}`;

    const payload = {
      update_id: effectiveUpdateId,
      message: {
        message_id: Math.floor(Math.random() * 100000),
        from: {
          id: telegramUserId,
          username,
          first_name: username.split('_')[0] || 'User',
        },
        chat: {
          id: telegramUserId,
          type: 'private',
        },
        text: text.trim(),
        date: Math.floor(Date.now() / 1000),
      },
    };

    const result = await TelegramService.handleWebhookUpdate(payload);

    return NextResponse.json({
      success: true,
      updateId: effectiveUpdateId,
      result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
