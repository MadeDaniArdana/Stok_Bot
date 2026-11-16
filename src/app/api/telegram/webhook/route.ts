import { NextRequest, NextResponse } from 'next/server';
import { TelegramService } from '@/services/telegram.service';
import {
  answerTelegramCallbackQuery,
  editTelegramMessage,
  sendTelegramMessage,
} from '@/lib/telegram-client';

export async function POST(req: NextRequest) {
  let chatId: string | number | undefined;
  let callbackQueryId: string | undefined;

  try {
    const payload = await req.json();
    const callback = payload?.callback_query;
    chatId = payload?.message?.chat?.id ?? callback?.message?.chat?.id;
    callbackQueryId = callback?.id;

    // 1. Verifikasi secret token jika diset
    const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (expectedSecret && secretHeader !== expectedSecret) {
      console.warn('Webhook rejected: Secret token mismatch.');
      return NextResponse.json({ error: 'Secret token tidak cocok' }, { status: 401 });
    }

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

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    console.error('Webhook execution error:', error);
    if (callbackQueryId) await answerTelegramCallbackQuery(callbackQueryId);

    // Beritahu pengguna di Telegram jika terjadi error server daripada diam tanpa balasan
    if (chatId) {
      await sendTelegramMessage(
        chatId,
        `⚠️ *Kendala Server:* ${error.message || 'Terjadi kesalahan sistem di server StockFlow.'}\n\nPeriksa koneksi database atau log Vercel.`
      );
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
