import { prisma } from '@/lib/prisma';
import { sendTelegramMessage, sendTelegramPhoto } from '@/lib/telegram-client';
import { readTaskProof } from '@/lib/task-proof-storage';
import { logError } from '@/lib/error-log';

export class NotificationService {
  /**
   * Check and create low stock or out of stock alert if conditions are met
   */
  static async checkStockLevelAndAlert(productId: string, stockAfter: number, actorUserId?: string | null) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) return;

    const todayDate = new Date().toISOString().split('T')[0];

    // Out of stock alert
    if (stockAfter === 0) {
      const dedupeKey = `out-of-stock-${productId}-${todayDate}`;
      const existing = await prisma.notification.findUnique({
        where: { dedupeKey },
      });

      if (!existing) {
        const notification = await prisma.notification.create({
          data: {
            productId,
            type: 'OUT_OF_STOCK',
            message: `PERINGATAN KRITIS: ${product.name} (SKU: ${product.sku}) telah HABIS (Stok: 0 ${product.unit}). Segera lakukan pengadaan!`,
            dedupeKey,
            isRead: false,
          },
        });
        await this.notifyAdmins(notification.message);
      }
      return;
    }

    // Low stock alert
    if (stockAfter <= product.minimumStock) {
      const dedupeKey = `low-stock-${productId}-${todayDate}`;
      const existing = await prisma.notification.findUnique({
        where: { dedupeKey },
      });

      if (!existing) {
        const notification = await prisma.notification.create({
          data: {
            productId,
            type: 'LOW_STOCK',
            message: `PERHATIAN: Stok ${product.name} tersisa ${stockAfter} ${product.unit}, sudah di bawah/mencapai batas minimum (${product.minimumStock} ${product.unit}).`,
            dedupeKey,
            isRead: false,
          },
        });
        await this.notifyAdmins(notification.message);
      }
    }
  }

  private static async notifyAdmins(message: string) {
    const admins = await prisma.telegramUser.findMany({
      where: {
        isActive: true,
        user: { isActive: true, role: 'ADMIN' },
      },
      select: { telegramChatId: true },
    });

    for (const admin of admins) {
      const sent = await sendTelegramMessage(admin.telegramChatId, message);
      if (!sent) {
        await logError({
          source: 'NOTIFICATION',
          level: 'WARNING',
          error: 'Notifikasi stok menipis gagal terkirim ke Telegram admin',
          location: 'checkStockLevelAndAlert',
          context: { chatId: admin.telegramChatId, pesan: message },
        });
      }
    }
  }

  static async notifyTaskCompleted(params: {
    creatorUserId: string;
    productName: string;
    quantity: number;
    unit: string;
    assigneeName: string;
    location: string;
    stockAfter: number;
    proofReference?: string | null;
    proofMimeType?: string | null;
  }) {
    const adminTelegram = await prisma.telegramUser.findUnique({
      where: { userId: params.creatorUserId },
      select: { telegramChatId: true, isActive: true },
    });

    if (!adminTelegram?.isActive) {
      await logError({
        source: 'NOTIFICATION',
        level: 'WARNING',
        error: 'Tugas selesai, tetapi admin pembuat tugas tidak terhubung ke Telegram',
        location: 'notifyTaskCompleted',
        context: { adminUserId: params.creatorUserId, barang: params.productName, pemasang: params.assigneeName },
      });
      return;
    }

    const message =
      `✅ Tugas pemasangan selesai.\nBarang: ${params.productName} (${params.quantity} ${params.unit})\n` +
      `Pemasang: ${params.assigneeName}\nLokasi: ${params.location}\nStok tersisa: ${params.stockAfter} ${params.unit}.`;

    // Kirim foto bukti beserta keterangan; jika gagal, tetap kirim pesan teks.
    let sent = false;
    if (params.proofReference && params.proofMimeType) {
      const photo = await readTaskProof(params.proofReference).catch(() => null);
      if (photo) sent = await sendTelegramPhoto(adminTelegram.telegramChatId, photo, params.proofMimeType, message);
    }
    if (!sent) sent = await sendTelegramMessage(adminTelegram.telegramChatId, message);
    if (!sent) {
      await logError({
        source: 'NOTIFICATION',
        error: 'Pesan "tugas selesai" gagal terkirim ke Telegram admin',
        location: 'notifyTaskCompleted',
        context: { adminUserId: params.creatorUserId, barang: params.productName, pemasang: params.assigneeName },
      });
    }
  }

  static async getNotifications(limit = 20) {
    return prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            unit: true,
            currentStock: true,
          },
        },
      },
    });
  }

  static async getUnreadCount() {
    return prisma.notification.count({
      where: { isRead: false },
    });
  }

  static async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  static async markAllAsRead() {
    return prisma.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });
  }
}
