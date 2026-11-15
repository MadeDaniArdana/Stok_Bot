/**
 * Telegram Bot API Client
 * Mengirim pesan balasan ke pengguna Telegram
 */
export async function sendTelegramMessage(chatId: string | number, text: string): Promise<boolean> {
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
      }),
    });

    if (!res.ok) {
      // Fallback: coba kirim plain text jika ada karakter Markdown yang tidak cocok
      const plainRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      });
      return plainRes.ok;
    }

    return true;
  } catch (error) {
    console.error('Gagal mengirim pesan ke Telegram:', error);
    return false;
  }
}
