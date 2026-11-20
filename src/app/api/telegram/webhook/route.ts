import { createHash, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { TelegramService } from '@/services/telegram.service';
import { logError } from '@/lib/error-log';
import {
  answerTelegramCallbackQuery,
  editTelegramMessage,
  sendTelegramMessage,
} from '@/lib/telegram-client';

export const runtime = 'nodejs';

function safeSecretEquals(received: string | null, expected: string): boolean {
  if (!received) return false;
  const receivedHash = createHash('sha256').update(received).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(receivedHash, expectedHash);
}

export async function POST(req: NextRequest) {
  let chatId: string | number | undefined;
  let callbackQueryId: string | undefined;

  try {
    // 1. Fail-closed: wajib konfigurasi TELEGRAM_WEBHOOK_SECRET dan cocokkan sebelum parse payload
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expectedSecret) {
      await logError({
        source: 'TELEGRAM',
        level: 'ERROR',
        error: 'Webhook ditolak: TELEGRAM_WEBHOOK_SECRET belum dikonfigurasi',
        location: 'POST /api/telegram/webhook',
      });
      return NextResponse.json({ error: 'Webhook belum dikonfigurasi.' }, { status: 500 });
    }

    const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
    if (!safeSecretEquals(secretHeader, expectedSecret)) {
      await logError({
        source: 'TELEGRAM',
        level: 'WARNING',
        error: 'Webhook ditolak: secret token tidak cocok',
        location: 'POST /api/telegram/webhook',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const callback = payload?.callback_query;
    chatId = payload?.message?.chat?.id ?? callback?.message?.chat?.id;
    callbackQueryId = callback?.id;

    if (!payload || !payload.update_id) {
      return NextResponse.json({ error: 'Invalid payload: update_id missing' }, { status: 400 });
    }

    // 2. Proses pesan bisnis
    const result = await TelegramService.handleWebhookUpdate(payload);

    if (callbackQueryId) await answerTelegramCallbackQuery(callbackQueryId);

    // 3. Update pesan tombol atau kirim balasan baru
    if (chatId && result.replyText) {
      if (callback?.message?.message_id) {
        const edited = await editTelegramMessage(
          chatId,
          callback.message.message_id,
          result.replyText,
          result.replyMarkup
        );
        if (!edited) {
          await sendTelegramMessage(chatId, result.replyText, result.replyMarkup);
        }
      } else {
        await sendTelegramMessage(chatId, result.replyText, result.replyMarkup);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    await logError({
      source: 'TELEGRAM',
      error,
      location: 'POST /api/telegram/webhook',
      context: { chatId, callbackQueryId },
    });
    if (callbackQueryId) await answerTelegramCallbackQuery(callbackQueryId);

    // Beritahu pengguna di Telegram jika terjadi error server daripada diam tanpa balasan
    if (chatId) {
      await sendTelegramMessage(
        chatId,
        `⚠️ Terjadi kendala di server StockFlow. Error sudah tercatat di menu Log Error web.`
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
