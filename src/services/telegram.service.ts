import { prisma } from '@/lib/prisma';
import { InstallationTaskService } from './installation-task.service';

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
}

export interface TelegramProcessResult {
  replyText: string;
  success: boolean;
  actionTaken?: string;
  error?: string;
}

export class TelegramService {
  /**
   * Proses pembaruan webhook dari Telegram
   */
  static async handleWebhookUpdate(payload: TelegramMessagePayload): Promise<TelegramProcessResult> {
    const updateId = String(payload.update_id);
    const msg = payload.message;

    if (!msg || !msg.text) {
      return {
        replyText: 'StockFlow Bot: Pesan kosong atau jenis pesan tidak didukung.',
        success: false,
      };
    }

    const telegramUserId = String(msg.from.id);
    const chatId = String(msg.chat.id);
    const username = msg.from.username || msg.from.first_name || 'pengguna';
    const text = msg.text.trim();

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
      const result = await this.processMessageText({
        telegramUserId,
        chatId,
        username,
        text,
      });

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
   * Parser & handler pesan Telegram
   */
  static async processMessageText(params: {
    telegramUserId: string;
    chatId: string;
    username: string;
    text: string;
  }): Promise<TelegramProcessResult> {
    const { telegramUserId, chatId, username, text } = params;
    const lower = text.toLowerCase();

    // /start command
    if (lower === '/start') {
      return {
        replyText: `👋 *Selamat datang di StockFlow Bot*, @${username}!\n\n` +
          `Admin dapat membuat tugas pemasangan di Telegram dan membagikan link bukti melalui WhatsApp.\n\n` +
          `📌 *Perintah Cepat:*\n` +
          `• \`/stok\` — Cek ringkasan stok gudang\n` +
          `• \`/cari <nama_barang>\` — Cari ketersediaan barang\n` +
          `• \`/riwayat\` — Cek riwayat pengambilan Anda\n` +
          `• \`/tugas\` — Lihat status tugas pemasangan (admin)\n` +
          `• \`/buat_tugas\` — Buat tugas pemasangan (admin)\n` +
          `• \`/bantuan\` — Panduan penggunaan bot\n` +
          `• \`/link <email_anda>\` — Tautkan akun StockFlow Anda\n\n` +
          `_ID Telegram Anda:_ \`${telegramUserId}\``,
        success: true,
        actionTaken: 'START',
      };
    }

    // /bantuan command
    if (lower === '/bantuan' || lower === '/help' || lower === '/pakai') {
      return {
        replyText:
          'Admin membuat tugas dengan format:\n\n' +
          'TUGAS\nBarang: Lampu\nJumlah: 1\nPemasang: Singgih\nLokasi: GSG\nCatatan: Opsional\n\n' +
          'Pemasang membuka link dari WhatsApp dan mengirim foto bukti. Stok berkurang setelah foto diterima.',
        success: true,
        actionTaken: 'HELP',
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

      return {
        replyText: `✅ *Berhasil terhubung!*\n\nAkun StockFlow atas nama *${user.name}* (${user.email}) kini telah resmi terhubung dengan Telegram Anda.\n\nAdmin yang diizinkan dapat membuat tugas pemasangan melalui \`/buat_tugas\`.`,
        success: true,
        actionTaken: 'LINKED',
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
          `Kirim: \`/link <email_anda>\` untuk menghubungkan akun terdaftar, atau hubungi Admin Gudang.`,
        success: false,
      };
    }

    const internalUser = tgUser.user;

    const allowedAdminIds = (process.env.TELEGRAM_ADMIN_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const isAllowedAdmin = internalUser.role === 'ADMIN' && allowedAdminIds.includes(telegramUserId);

    if (lower === '/buat_tugas' || lower.startsWith('/buat_tugas ') || lower.startsWith('tugas')) {
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
            { name: { contains: parsed.productQuery } },
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

    if (lower === '/tugas') {
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
        return { replyText: 'Belum ada tugas pemasangan yang tercatat.', success: true, actionTaken: 'TASK_LIST_EMPTY' };
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
      };
    }

    // /stok command
    if (lower === '/stok') {
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

      response += `\nGunakan \`/cari <nama>\` untuk mencari barang spesifik.`;
      return {
        replyText: response,
        success: true,
        actionTaken: 'STOCK_SUMMARY',
      };
    }

    // /cari command
    if (lower.startsWith('/cari')) {
      const query = text.replace(/^\/cari/i, '').trim();
      if (!query) {
        return {
          replyText: `⚠️ Masukkan nama atau SKU barang yang ingin dicari.\nContoh: \`/cari Kertas\``,
          success: false,
        };
      }

      const found = await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: query } },
            { sku: { contains: query } },
          ],
        },
        take: 10,
      });

      if (found.length === 0) {
        return {
          replyText: `🔍 Tidak ditemukan barang dengan kata kunci: *${query}*. Periksa kembali penulisan nama atau SKU.`,
          success: true,
          actionTaken: 'SEARCH_EMPTY',
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
      };
    }

    // /riwayat command
    if (lower === '/riwayat') {
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
      replyText: `StockFlow Bot: Perintah tidak dikenali.\nKetik \`/bantuan\` untuk panduan atau \`/stok\` untuk mengecek persediaan barang.`,
      success: false,
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
