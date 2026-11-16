import { prisma } from '@/lib/prisma';
import { InventoryService } from './inventory.service';

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
        updateId,
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
    updateId: string;
  }): Promise<TelegramProcessResult> {
    const { telegramUserId, chatId, username, text, updateId } = params;
    const lower = text.toLowerCase();

    // /start command
    if (lower === '/start') {
      return {
        replyText: `👋 *Selamat datang di StockFlow Bot*, @${username}!\n\n` +
          `Sistem manajemen persediaan otomatis. Anda dapat mengecek stok dan melaporkan pengambilan barang langsung dari Telegram.\n\n` +
          `📌 *Perintah Cepat:*\n` +
          `• \`/stok\` — Cek ringkasan stok gudang\n` +
          `• \`/cari <nama_barang>\` — Cari ketersediaan barang\n` +
          `• \`/riwayat\` — Cek riwayat pengambilan Anda\n` +
          `• \`/bantuan\` — Format pelaporan barang keluar\n` +
          `• \`/link <email_anda>\` — Tautkan akun StockFlow Anda\n\n` +
          `_ID Telegram Anda:_ \`${telegramUserId}\``,
        success: true,
        actionTaken: 'START',
      };
    }

    // /bantuan command
    if (lower === '/bantuan' || lower === '/help' || lower === '/pakai') {
      return {
        replyText: `📋 *Panduan Format Laporan Pengambilan Barang:*\n\n` +
          `Kirim pesan terstruktur dengan format berikut:\n\n` +
          `\`\`\`\n` +
          `PAKAI\n` +
          `Barang: Kertas A4\n` +
          `Jumlah: 5\n` +
          `Keperluan: Administrasi Kantor\n` +
          `\`\`\`\n\n` +
          `💡 *Catatan:*\n` +
          `• Satuan mengikuti satuan dasar master barang di sistem.\n` +
          `• Jumlah harus angka positif.\n` +
          `• Akun Telegram Anda harus sudah dihubungkan ke sistem.`,
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
        replyText: `✅ *Berhasil terhubung!*\n\nAkun StockFlow atas nama *${user.name}* (${user.email}) kini telah resmi terhubung dengan Telegram Anda.\n\nSekarang Anda dapat langsung melaporkan pemakaian barang dengan format \`PAKAI\`!`,
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

    // Format PAKAI: Structured format
    if (lower.startsWith('pakai') || lower.includes('barang:')) {
      const parsed = this.parsePakaiMessage(text);

      if (!parsed.valid || !parsed.productQuery || !parsed.quantity) {
        return {
          replyText: `⚠️ *Saya belum bisa memastikan barang atau jumlahnya.*\n\n` +
            `Silakan kirim dengan format terstruktur:\n` +
            `\`\`\`\n` +
            `PAKAI\n` +
            `Barang: <nama atau kode barang>\n` +
            `Jumlah: <angka>\n` +
            `Keperluan: <alasan/keperluan>\n` +
            `\`\`\``,
          success: false,
          actionTaken: 'CLARIFICATION_REQUIRED',
        };
      }

      // Cari barang berdasarkan query
      const candidateProducts = await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { sku: { equals: parsed.productQuery.toUpperCase() } },
            { name: { contains: parsed.productQuery } },
          ],
        },
      });

      if (candidateProducts.length === 0) {
        return {
          replyText: `❌ Barang *${parsed.productQuery}* tidak ditemukan di katalog gudang. Gunakan \`/cari ${parsed.productQuery}\` untuk mengecek nama yang benar.`,
          success: false,
        };
      }

      // Ambiguitas check (PRD rule: jika lebih dari satu barang cocok, jangan ubah stok!)
      if (candidateProducts.length > 1) {
        const listText = candidateProducts
          .map((p) => `• \`${p.sku}\` — ${p.name} (Stok: ${p.currentStock} ${p.unit})`)
          .join('\n');

        return {
          replyText: `❓ Ditemukan lebih dari 1 barang yang cocok dengan "*${parsed.productQuery}*":\n\n${listText}\n\n` +
            `Mohon ulangi laporan dengan menuliskan SKU atau nama yang lebih spesifik agar stok tidak keliru terpotong.`,
          success: false,
          actionTaken: 'AMBIGUOUS_PRODUCT',
        };
      }

      const targetProduct = candidateProducts[0];

      // Eksekusi transaksi stock out
      try {
        const txResult = await InventoryService.recordStockOut({
          productId: targetProduct.id,
          quantity: parsed.quantity,
          actorUserId: internalUser.id,
          source: 'TELEGRAM',
          telegramUpdateId: updateId,
          notes: parsed.notes ? `Keperluan: ${parsed.notes}` : 'Pengambilan via Telegram',
        });

        const proofSection = (txResult as any).proofUrl
          ? `\n\n📸 *Ambil Foto Bukti Pemakaian:*\nSilakan foto barang yang telah diambil lewat link kamera ini (tanpa login):\n👉 ${(txResult as any).proofUrl}`
          : '';

        return {
          replyText: `✅ *Pengambilan berhasil dicatat.*\n\n` +
            `Barang: *${targetProduct.name}*\n` +
            `Jumlah: *${parsed.quantity} ${targetProduct.unit}*\n` +
            `Stok sebelumnya: ${txResult.movement.stockBefore} ${targetProduct.unit}\n` +
            `Stok sekarang: *${txResult.stockAfter} ${targetProduct.unit}*\n` +
            `Pelapor: ${internalUser.name}\n` +
            `Keperluan: ${parsed.notes || '-'}` +
            proofSection +
            `\n\n_Terima kasih telah mencatat inventori secara tertib!_`,
          success: true,
          actionTaken: 'STOCK_OUT_SUCCESS',
        };
      } catch (err: any) {
        return {
          replyText: `⚠️ *Pengambilan belum dapat dicatat.*\n\n` +
            `Barang: *${targetProduct.name}*\n` +
            `Diminta: ${parsed.quantity} ${targetProduct.unit}\n` +
            `Stok tersedia: *${targetProduct.currentStock} ${targetProduct.unit}*\n\n` +
            `Pesan Sistem: ${err.message}\n` +
            `Silakan hubungi admin jika data stok perlu diperiksa.`,
          success: false,
          error: err.message,
        };
      }
    }

    // Default unknown command
    return {
      replyText: `StockFlow Bot: Perintah tidak dikenali.\nKetik \`/bantuan\` untuk melihat format pelaporan atau \`/stok\` untuk mengecek persediaan barang.`,
      success: false,
    };
  }

  /**
   * Helper parser untuk format "PAKAI"
   */
  private static parsePakaiMessage(text: string) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    let productQuery = '';
    let quantity = 0;
    let notes = '';

    for (const line of lines) {
      if (/^(?:pakai\s+)?barang\s*:/i.test(line)) {
        productQuery = line.replace(/^(?:pakai\s+)?barang\s*:/i, '').trim();
      } else if (/^jumlah\s*:/i.test(line)) {
        const val = line.replace(/^jumlah\s*:/i, '').trim();
        const num = parseInt(val, 10);
        if (!isNaN(num)) quantity = num;
      } else if (/^keperluan\s*:/i.test(line)) {
        notes = line.replace(/^keperluan\s*:/i, '').trim();
      }
    }

    // Fallback parser jika user mengetik 1 baris seperti "PAKAI Kertas A4 5 Keperluan Administrasi"
    if (!productQuery && lines.length === 1) {
      const match = text.match(/pakai\s+(.+?)\s+(\d+)(?:\s+(?:keperluan|untuk)?\s*(.*))?$/i);
      if (match) {
        productQuery = match[1].trim();
        quantity = parseInt(match[2], 10);
        notes = match[3] ? match[3].trim() : '';
      }
    }

    return {
      valid: Boolean(productQuery && quantity > 0),
      productQuery,
      quantity,
      notes,
    };
  }
}
