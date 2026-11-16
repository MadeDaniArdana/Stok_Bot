/**
 * Telegram Bot API Client
 * Mengirim pesan balasan ke pengguna Telegram
 */
import { logError } from './error-log';

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: Array<Array<{
    text: string;
    callback_data?: string;
    url?: string;
  }>>;
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  replyMarkup?: TelegramInlineKeyboardMarkup
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN belum diset.');
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }),
    });

    if (!res.ok) {
      console.error(`Telegram sendMessage gagal (${res.status}): ${await res.text()}`);
      const plainRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          reply_markup: replyMarkup,
        }),
      });
      if (!plainRes.ok) {
        await logError({
          source: 'TELEGRAM',
          error: `Bot gagal mengirim pesan (${plainRes.status}): ${await plainRes.text()}`,
          location: 'sendTelegramMessage',
          context: { chatId, pesan: text.slice(0, 200) },
        });
      }
      return plainRes.ok;
    }

    return true;
  } catch (error) {
    await logError({ source: 'TELEGRAM', error, location: 'sendTelegramMessage', context: { chatId } });
    return false;
  }
}

export async function editTelegramMessage(
  chatId: string | number,
  messageId: number,
  text: string,
  replyMarkup?: TelegramInlineKeyboardMarkup
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN belum diset.');
    return false;
  }

  const endpoint = `https://api.telegram.org/bot${token}/editMessageText`;
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: replyMarkup,
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, parse_mode: 'Markdown' }),
    });

    if (res.ok) return true;

    console.error(`Telegram editMessageText gagal (${res.status}): ${await res.text()}`);
    const plainRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!plainRes.ok) {
      console.error(`Telegram editMessageText fallback gagal (${plainRes.status}): ${await plainRes.text()}`);
    }
    return plainRes.ok;
  } catch (error) {
    console.error('Gagal mengedit pesan Telegram:', error);
    return false;
  }
}

export async function answerTelegramCallbackQuery(callbackQueryId: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN belum diset.');
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
    if (!res.ok) {
      console.error(`Telegram answerCallbackQuery gagal (${res.status}): ${await res.text()}`);
    }
    return res.ok;
  } catch (error) {
    console.error('Gagal menjawab callback Telegram:', error);
    return false;
  }
}

/** Mengirim foto (bytes) beserta keterangan. Mengembalikan false jika gagal. */
export async function sendTelegramPhoto(
  chatId: string | number,
  photo: Buffer,
  mimeType: string,
  caption: string
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN belum diset.');
    return false;
  }

  try {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', caption.slice(0, 1024));
    form.append('photo', new Blob([new Uint8Array(photo)], { type: mimeType }), 'bukti.jpg');

    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: form });
    if (!res.ok) {
      await logError({
        source: 'TELEGRAM',
        level: 'WARNING',
        error: `Bot gagal mengirim foto bukti (${res.status}): ${await res.text()}`,
        location: 'sendTelegramPhoto',
        context: { chatId },
      });
    }
    return res.ok;
  } catch (error) {
    console.error('Gagal mengirim foto ke Telegram:', error);
    return false;
  }
}
