import type { TelegramInlineKeyboardMarkup } from './telegram-client';

export function buildMainMenuKeyboard(isAllowedAdmin: boolean): TelegramInlineKeyboardMarkup {
  const keyboard: TelegramInlineKeyboardMarkup['inline_keyboard'] = [];

  if (isAllowedAdmin) {
    keyboard.push([{ text: '➕ Buat tugas pemasangan', callback_data: 'menu:create_task' }]);
  }

  keyboard.push([
    { text: '📦 Cek stok', callback_data: 'menu:stock' },
    { text: '🔎 Cari barang', callback_data: 'menu:search' },
  ]);
  if (isAllowedAdmin) {
    keyboard.push([
      { text: '📋 Tugas terbaru', callback_data: 'menu:tasks' },
      { text: '📜 Riwayat saya', callback_data: 'menu:history' },
    ]);
  } else {
    keyboard.push([{ text: '📜 Riwayat saya', callback_data: 'menu:history' }]);
  }
  keyboard.push([{ text: '❔ Bantuan', callback_data: 'menu:help' }]);

  return { inline_keyboard: keyboard };
}

export function buildCancelKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [[{ text: '✖️ Batal', callback_data: 'task:cancel' }]],
  };
}
