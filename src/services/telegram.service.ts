import { prisma } from '@/lib/prisma';
import { buildMainMenuKeyboard } from '@/lib/telegram-keyboards';
import type { TelegramInlineKeyboardMarkup } from '@/lib/telegram-client';
import { InstallationTaskService } from './installation-task.service';
import { TelegramTaskWizardService } from './telegram-task-wizard.service';

export interface TelegramMessagePayload {
  update_id: number | string;
  message?: {
    message_id: number;
    from: {
      id: number | string;
      is_bot?: boolean;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number | string;
      type: string;
      title?: string;
    };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: {
      id: number | string;
      first_name?: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number | string;
        type: string;
      };
    };
    data?: string;
  };
}

export interface TelegramProcessResult {
  replyText: string;
  success: boolean;
  actionTaken?: string;
  error?: string;
  replyMarkup?: TelegramInlineKeyboardMarkup;
}

export class TelegramService {
  /**
   * Proses pembaruan webhook dari Telegram
   */
  static async handleWebhookUpdate(payload: TelegramMessagePayload): Promise<TelegramProcessResult> {
    const updateId = String(payload.update_id);
    const msg = payload.message;
    const callback = payload.callback_query;

    if ((!msg || !msg.text) && !callback) {
      return {
        replyText: 'StockFlow Bot: Pesan kosong atau jenis pesan tidak didukung.',
        success: false,
      };
    }

    const telegramUserId = String(msg?.from.id ?? callback?.from.id);
    const callbackChatId = callback?.message?.chat.id;
    const chatId = String(msg?.chat.id ?? callbackChatId ?? '');
    const username = msg?.from.username || callback?.from.username || msg?.from.first_name || callback?.from.first_name || 'pengguna';
    const text = msg?.text?.trim() || '';
    if (!chatId) {
      return { replyText: 'Pesan Telegram tidak memiliki chat yang dapat digunakan.', success: false };
    }

    // 1. Cek Idempotensi Webhook Update (Resilient)
    let existingUpdate = null;
    try {
      existingUpdate = await prisma.telegramUpdate.findUnique({
        where: { telegramUpdateId: updateId },
      });
    } catch (e: any) {
      console.warn('Idempotency check skipped (DB warning):', e.message);
    }

    if (existingUpdate && existingUpdate.status === 'PROCESSED') {
      return {
        replyText: 'Pesan ini sudah pernah diproses sebelumnya (Idempotent).',
        success: true,
        actionTaken: 'DUPLICATE_IGNORED',
      };
    }

    // Catat penerimaan update
    if (!existingUpdate) {
      try {
        await prisma.telegramUpdate.create({
          data: {
            telegramUpdateId: updateId,
            chatId,
            telegramUserId,
            payload: JSON.stringify(payload),
            status: 'PROCESSING',
          },
        });
      } catch (e: any) {
        console.warn('Update logging skipped (DB warning):', e.message);
      }
    }

    try {
      const result = callback
        ? await this.processCallbackQuery({
          telegramUserId,
          chatId,
          username,
          callbackData: callback.data || '',
        })
        : await this.processMessageText({ telegramUserId, chatId, username, text });

      // Tandai update PROCESSED
      try {
        await prisma.telegramUpdate.update({
          where: { telegramUpdateId: updateId },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      } catch (e) {}

      return result;
    } catch (err: any) {
      try {
        await prisma.telegramUpdate.update({
          where: { telegramUpdateId: updateId },
          data: {
            status: 'FAILED',
            errorMessage: err.message,
            processedAt: new Date(),
          },
        });
      } catch (e) {}

      return {
        replyText: `Terjadi kendala saat memproses: ${err.message}`,
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Admin yang ID Telegram-nya ada di TELEGRAM_ADMIN_IDS otomatis dihubungkan
   * ke akun ADMIN pertama yang belum punya tautan Telegram, tanpa perlu mengetik /link.
   */
  private static async autoLinkAdmin(telegramUserId: string, chatId: string, username: string) {
    const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map((id) => id.trim()).filter(Boolean);
    if (!adminIds.includes(telegramUserId)) return;

    const existing = await prisma.telegramUser.findUnique({ where: { telegramUserId } });
    if (existing) return;

    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true, telegram: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!adminUser) return;

    await prisma.telegramUser.create({
      data: { userId: adminUser.id, telegramUserId, telegramChatId: chatId, username, isActive: true },
    });
  }

  static async processCallbackQuery(params: {
    telegramUserId: string;
    chatId: string;
    username: string;
    callbackData: string;
  }): Promise<TelegramProcessResult> {
    const { telegramUserId, chatId, username, callbackData } = params;
    await this.autoLinkAdmin(telegramUserId, chatId, username);
    const tgUser = await prisma.telegramUser.findUnique({
      where: { telegramUserId },
      include: { user: true },
    });

    if (!tgUser || !tgUser.isActive || !tgUser.user.isActive) {
      return {
        replyText: 'Akun Telegram ini belum terdaftar. Minta admin menambahkan ID Telegram Anda (' + telegramUserId + ') ke daftar admin.',
        success: false,
        actionTaken: 'UNLINKED_USER',
      };
    }

    const allowedAdminIds = (process.env.TELEGRAM_ADMIN_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const isAllowedAdmin = tgUser.user.role === 'ADMIN' && allowedAdminIds.includes(telegramUserId);

    if (
      callbackData === 'menu:create_task' ||
      callbackData === 'menu:search' ||
      callbackData === 'menu:home' ||
      callbackData.startsWith('task:')
    ) {
      return TelegramTaskWizardService.handleCallback(
        telegramUserId,
        chatId,
        tgUser.user.id,
        isAllowedAdmin,
        callbackData
      );
    }

    const menuCommands: Record<string, string> = {
      'menu:stock': '/stok',
      'menu:tasks': '/tugas',
      'menu:history': '/riwayat',
      'menu:help': '/bantuan',
    };
    const command = menuCommands[callbackData];
    if (!command) {
      return {
        replyText: 'Tombol tidak dikenali. Pilih menu di bawah.',
        success: false,
        actionTaken: 'INVALID_BUTTON',
        replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
      };
    }

    return this.processMessageText({
      telegramUserId,
      chatId,
      username,
      text: command,
    });
  }

  /**
   * Parser & handler pesan Telegram
   */
  static async processMessageText(params: {
    telegramUserId: string;
    chatId: string;
    username: string;
    text: string;
  }): Promise<TelegramProcessResult> {
    const { telegramUserId, chatId, username, text } = params;
    await this.autoLinkAdmin(telegramUserId, chatId, username);
    const lower = text.toLowerCase();

    // /start command
    if (lower === '/start') {
      const linkedUser = await prisma.telegramUser.findUnique({
        where: { telegramUserId },
        include: { user: true },
      });
      const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map((id) => id.trim());
      const isAllowedAdmin = Boolean(
        linkedUser?.isActive &&
        linkedUser.user.isActive &&
        linkedUser.user.role === 'ADMIN' &&
        adminIds.includes(telegramUserId)
      );

      return {
        replyText: linkedUser?.isActive && linkedUser.user.isActive
          ? `👋 Selamat datang di StockFlow Bot, ${linkedUser.user.name}!\nPilih menu dengan menekan tombol di bawah.`
          : `👋 Selamat datang di StockFlow Bot, @${username}!\n\nAkun Telegram ini belum terdaftar sebagai admin.\nID Telegram Anda: ${telegramUserId}\nMinta pengelola sistem menambahkan ID ini ke TELEGRAM_ADMIN_IDS.`,
        success: true,
        actionTaken: 'START',
        replyMarkup: linkedUser?.isActive && linkedUser.user.isActive
          ? buildMainMenuKeyboard(isAllowedAdmin)
          : undefined,
      };
    }

    // /bantuan command
    if (lower === '/bantuan' || lower === '/help' || lower === '/pakai') {
      const linkedUser = await prisma.telegramUser.findUnique({
        where: { telegramUserId },
        include: { user: true },
      });
      const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map((id) => id.trim());
      const isAllowedAdmin = Boolean(
        linkedUser?.isActive &&
        linkedUser.user.isActive &&
        linkedUser.user.role === 'ADMIN' &&
        adminIds.includes(telegramUserId)
      );

      return {
        replyText:
          'Pilih tombol menu untuk melihat stok, mencari barang, atau melihat riwayat. Admin dapat membuat tugas pemasangan dengan memilih barang dan jumlah, lalu mengisi nama pemasang dan lokasi.\n\n' +
          'Pemasang menerima link melalui WhatsApp lalu mengirim foto bukti. Stok berkurang setelah foto diterima.',
        success: true,
        actionTaken: 'HELP',
        replyMarkup: linkedUser?.isActive && linkedUser.user.isActive
          ? buildMainMenuKeyboard(isAllowedAdmin)
          : undefined,
      };
    }

    // /link command
    if (lower.startsWith('/link')) {
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        return {
          replyText: `⚠️ *Format pengaitan salah.*\nContoh: \`/link admin@stockflow.com\``,
          success: false,
        };
      }

      const inputEmail = parts[1].trim().toLowerCase();
      const allUsers = await prisma.user.findMany({
        include: { telegram: true },
      });
      const user = allUsers.find((u) => u.email.toLowerCase() === inputEmail);

      if (!user) {
        return {
          replyText: `❌ Akun dengan email *${inputEmail}* tidak ditemukan di StockFlow. Hubungi administrator.`,
          success: false,
        };
      }

      // Akun admin hanya boleh dihubungkan dari ID Telegram yang terdaftar di TELEGRAM_ADMIN_IDS,
      // supaya orang lain tidak bisa mengambil alih (dan memutus) tautan Telegram admin.
      const linkAdminIds = (process.env.TELEGRAM_ADMIN_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (user.role === 'ADMIN' && !linkAdminIds.includes(telegramUserId)) {
        return {
          replyText: '❌ Akun admin hanya dapat dihubungkan dari akun Telegram admin yang terdaftar.',
          success: false,
          actionTaken: 'LINK_ADMIN_DENIED',
        };
      }

      // Upsert telegram link
      await prisma.telegramUser.upsert({
        where: { userId: user.id },
        update: {
          telegramUserId,
          telegramChatId: chatId,
          username,
          isActive: true,
        },
        create: {
          userId: user.id,
          telegramUserId,
          telegramChatId: chatId,
          username,
          isActive: true,
        },
      });

      const allowedAdminIds = (process.env.TELEGRAM_ADMIN_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      const isAllowedAdmin = user.role === 'ADMIN' && allowedAdminIds.includes(telegramUserId);

      return {
        replyText: `✅ Akun ${user.name} berhasil terhubung. Pilih menu berikutnya dengan tombol di bawah.`,
        success: true,
        actionTaken: 'LINKED',
        replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
      };
    }

    // Autentikasi Pengguna: Pastikan user terdaftar dan terhubung
    const tgUser = await prisma.telegramUser.findUnique({
      where: { telegramUserId },
      include: { user: true },
    });

    if (!tgUser || !tgUser.isActive || !tgUser.user.isActive) {
      return {
        replyText: `⛔ *Akses Ditolak*\n\nAkun Telegram Anda (\`${telegramUserId}\`) belum terhubung atau berstatus nonaktif di StockFlow.\n\n` +
          `Minta pengelola sistem menambahkan ID ini ke daftar admin (TELEGRAM_ADMIN_IDS).`,
        success: false,
      };
    }

    const internalUser = tgUser.user;

    const allowedAdminIds = (process.env.TELEGRAM_ADMIN_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const isAllowedAdmin = internalUser.role === 'ADMIN' && allowedAdminIds.includes(telegramUserId);

    if (lower === '🔎 cari barang') {
      return TelegramTaskWizardService.handleCallback(
        telegramUserId,
        chatId,
        internalUser.id,
        isAllowedAdmin,
        'menu:search'
      );
    }

    if (lower === '/batal' || lower === 'batal' || lower === '✖️ batal') {
      return TelegramTaskWizardService.handleCallback(
        telegramUserId,
        chatId,
        internalUser.id,
        isAllowedAdmin,
        'task:cancel'
      );
    }

    if (!lower.startsWith('/')) {
      const wizardResult = await TelegramTaskWizardService.handleText(
        telegramUserId,
        chatId,
        isAllowedAdmin,
        text
      );
      if (wizardResult) return wizardResult;
    }

    if (
      lower === '/buat_tugas' ||
      lower === 'buat tugas' ||
      lower === '➕ buat tugas pemasangan'
    ) {
      if (!isAllowedAdmin) {
        return {
          replyText: 'Akses ditolak. Fitur tugas hanya tersedia untuk admin Telegram yang sudah diizinkan.',
          success: false,
        };
      }

      return TelegramTaskWizardService.start(telegramUserId, chatId);
    }

    if (
      (lower.startsWith('/buat_tugas ') || lower.startsWith('tugas')) &&
      lower.includes('barang:')
    ) {
      if (!isAllowedAdmin) {
        return {
          replyText: 'Akses ditolak. Perintah tugas hanya tersedia untuk admin Telegram yang sudah diizinkan.',
          success: false,
        };
      }

      const parsed = this.parseInstallationTask(text);
      if (!parsed) {
        return {
          replyText:
            'Kirim tugas dengan format berikut:\n\n' +
            'TUGAS\nBarang: Lampu\nJumlah: 1\nPemasang: Singgih\nLokasi: GSG\nCatatan: Pasang di aula',
          success: false,
          actionTaken: 'TASK_FORMAT_REQUIRED',
        };
      }

      const matches = await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { sku: { equals: parsed.productQuery.toUpperCase() } },
            { name: { contains: parsed.productQuery, mode: 'insensitive' } },
          ],
        },
        take: 10,
      });

      if (matches.length !== 1) {
        return {
          replyText: matches.length
            ? `Nama barang "${parsed.productQuery}" cocok dengan beberapa barang. Kirim ulang menggunakan SKU yang tepat.`
            : `Barang "${parsed.productQuery}" tidak ditemukan di katalog aktif.`,
          success: false,
          actionTaken: matches.length ? 'AMBIGUOUS_PRODUCT' : 'PRODUCT_NOT_FOUND',
        };
      }

      try {
        const { task, token } = await InstallationTaskService.create({
          productId: matches[0].id,
          quantity: parsed.quantity,
          assigneeName: parsed.assigneeName,
          location: parsed.location,
          notes: parsed.notes,
          creatorUserId: internalUser.id,
        });
        const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
        const proofUrl = `${appUrl}/proof/${token}`;
        const whatsappMessage = encodeURIComponent(
          `Halo ${task.assigneeName}, mohon selesaikan tugas pemasangan ${task.product.name} di ${task.location} dan kirim foto bukti melalui link ini: ${proofUrl}`
        );

        return {
          replyText:
            `Tugas pemasangan dibuat.\n` +
            `Barang: ${task.product.name} (${task.quantity} ${task.product.unit})\n` +
            `Pemasang: ${task.assigneeName}\nLokasi: ${task.location}\n` +
            `Status: Menunggu bukti foto\n\n` +
            `Link bukti: ${proofUrl}\n` +
            `Bagikan melalui WhatsApp: https://wa.me/?text=${whatsappMessage}\n\n` +
            `Stok akan berkurang setelah foto bukti berhasil dikirim.`,
          success: true,
          actionTaken: 'INSTALLATION_TASK_CREATED',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gagal membuat tugas.';
        return { replyText: `Tugas tidak dibuat: ${message}`, success: false, error: message };
      }
    }

    if (lower === '/tugas' || lower === '📋 tugas terbaru') {
      if (!isAllowedAdmin) {
        return {
          replyText: 'Akses ditolak. Status tugas hanya tersedia untuk admin Telegram yang sudah diizinkan.',
          success: false,
        };
      }

      const tasks = await prisma.installationTask.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { product: true },
      });
      if (!tasks.length) {
        return {
          replyText: 'Belum ada tugas pemasangan yang tercatat.',
          success: true,
          actionTaken: 'TASK_LIST_EMPTY',
          replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
        };
      }

      const lines = tasks.map((task) => {
        const state = task.status === 'COMPLETED' ? 'Selesai' : 'Menunggu bukti';
        const date = task.createdAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        return `• ${task.product.name} (${task.quantity} ${task.product.unit}) — ${task.assigneeName}, ${task.location}\n  ${state} | ${date}`;
      });
      return {
        replyText: `10 tugas pemasangan terbaru:\n\n${lines.join('\n\n')}`,
        success: true,
        actionTaken: 'TASK_LIST',
        replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
      };
    }

    // /stok command
    if (lower === '/stok' || lower === '📦 cek stok') {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        orderBy: { currentStock: 'asc' },
        take: 15,
      });

      let response = `📦 *Ringkasan Stok Terkini:*\n\n`;
      products.forEach((p) => {
        let statusIcon = '🟢';
        if (p.currentStock === 0) statusIcon = '🔴';
        else if (p.currentStock <= p.minimumStock) statusIcon = '🟡';

        response += `${statusIcon} *${p.name}*\n   Stok: \`${p.currentStock} ${p.unit}\` (Min: ${p.minimumStock})\n`;
      });

      response += '\nTekan "Cari barang" untuk mencari nama atau SKU.';
      return {
        replyText: response,
        success: true,
        actionTaken: 'STOCK_SUMMARY',
        replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
      };
    }

    // /cari command
    if (lower.startsWith('/cari')) {
      const query = text.replace(/^\/cari/i, '').trim();
      if (!query) {
        return {
          replyText: 'Kirim nama barang atau SKU yang ingin dicari.',
          success: false,
          replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
        };
      }

      const found = await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { sku: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 10,
      });

      if (found.length === 0) {
        return {
          replyText: `🔍 Tidak ditemukan barang dengan kata kunci: *${query}*. Periksa kembali penulisan nama atau SKU.`,
          success: true,
          actionTaken: 'SEARCH_EMPTY',
          replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
        };
      }

      let response = `🔍 *Hasil Pencarian "${query}":*\n\n`;
      found.forEach((p) => {
        let statusBadge = p.currentStock === 0 ? '❌ Habis' : p.currentStock <= p.minimumStock ? '⚠️ Stok Rendah' : '✅ Aman';
        response += `• *${p.name}* [${p.sku}]\n   Tersedia: \`${p.currentStock} ${p.unit}\` (${statusBadge})\n`;
      });

      return {
        replyText: response,
        success: true,
        actionTaken: 'SEARCH_RESULTS',
        replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
      };
    }

    // /riwayat command
    if (lower === '/riwayat' || lower === '📜 riwayat saya') {
      const movements = await prisma.stockMovement.findMany({
        where: {
          actorUserId: internalUser.id,
          type: 'OUT',
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { product: true },
      });

      if (movements.length === 0) {
        return {
          replyText: `📜 Anda belum memiliki riwayat pengambilan barang di sistem.`,
          success: true,
          actionTaken: 'HISTORY_EMPTY',
          replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
        };
      }

      let response = `📜 *5 Riwayat Pengambilan Terakhir Anda:*\n\n`;
      movements.forEach((m) => {
        const dateStr = new Date(m.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        response += `• *${m.product.name}*\n   Jumlah: \`${m.quantity} ${m.product.unit}\` | ${dateStr}\n   Keperluan: _${m.notes || '-' }_\n\n`;
      });

      return {
        replyText: response,
        success: true,
        actionTaken: 'HISTORY_LIST',
        replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
      };
    }

    if (lower.startsWith('pakai') || lower.includes('barang:')) {
      return {
        replyText: 'Pencatatan langsung melalui Telegram sudah tidak digunakan. Admin perlu membuat TUGAS pemasangan agar pemasang dapat mengirim foto bukti.',
        success: false,
        actionTaken: 'LEGACY_STOCK_OUT_DISABLED',
      };
    }

    // Default unknown command
    return {
      replyText: 'Pilih salah satu menu di bawah. Untuk membatalkan proses yang sedang berjalan, tekan Batal.',
      success: false,
      replyMarkup: buildMainMenuKeyboard(isAllowedAdmin),
    };
  }

  private static parseInstallationTask(text: string) {
    const values: Record<string, string> = {};
    for (const line of text.split('\n').map((item) => item.trim()).filter(Boolean)) {
      const match = line.match(/^(barang|jumlah|pemasang|lokasi|catatan)\s*:\s*(.*)$/i);
      if (match) values[match[1].toLowerCase()] = match[2].trim();
    }

    const quantity = Number(values.jumlah);
    if (!values.barang || !Number.isInteger(quantity) || quantity <= 0 || !values.pemasang || !values.lokasi) {
      return null;
    }

    return {
      productQuery: values.barang,
      quantity,
      assigneeName: values.pemasang,
      location: values.lokasi,
      notes: values.catatan,
    };
  }
}
