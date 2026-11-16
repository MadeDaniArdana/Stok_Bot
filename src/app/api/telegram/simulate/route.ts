import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { TelegramService } from '@/services/telegram.service';

export async function POST(req: NextRequest) {
  // Simulator bisa menyamar sebagai ID Telegram mana pun (termasuk admin),
  // jadi di production hanya aktif jika diizinkan secara eksplisit.
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_TELEGRAM_SIMULATOR !== 'true') {
    return NextResponse.json(
      { error: 'Simulator Telegram dinonaktifkan di production. Gunakan bot Telegram asli.' },
      { status: 403 }
    );
  }

  try {
    const {
      text,
      callbackData,
      messageId,
      telegramUserId = '78291044',
      username = 'sitirahma_ops',
      updateId,
    } = await req.json();

    if ((!text || !text.trim()) && !callbackData) {
      return NextResponse.json({ error: 'Teks atau pilihan tombol wajib diisi' }, { status: 400 });
    }

    const effectiveUpdateId = updateId || `sim-${Date.now()}`;
    const from = {
      id: telegramUserId,
      username,
      first_name: username.split('_')[0] || 'User',
    };
    const chat = {
      id: telegramUserId,
      type: 'private',
    };
    const payload = callbackData
      ? {
        update_id: effectiveUpdateId,
        callback_query: {
          id: `sim-callback-${effectiveUpdateId}`,
          from,
          message: {
            message_id: Number(messageId) || Math.floor(Math.random() * 100000),
            chat,
          },
          data: callbackData,
        },
      }
      : {
        update_id: effectiveUpdateId,
        message: {
          message_id: Math.floor(Math.random() * 100000),
          from,
          chat,
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
    return apiError(error, 'POST /api/telegram/simulate');
  }
}
