import { prisma } from '@/lib/prisma';

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
        await prisma.notification.create({
          data: {
            productId,
            type: 'OUT_OF_STOCK',
            message: `PERINGATAN KRITIS: ${product.name} (SKU: ${product.sku}) telah HABIS (Stok: 0 ${product.unit}). Segera lakukan pengadaan!`,
            dedupeKey,
            isRead: false,
          },
        });
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
        await prisma.notification.create({
          data: {
            productId,
            type: 'LOW_STOCK',
            message: `PERHATIAN: Stok ${product.name} tersisa ${stockAfter} ${product.unit}, sudah di bawah/mencapai batas minimum (${product.minimumStock} ${product.unit}).`,
            dedupeKey,
            isRead: false,
          },
        });
      }
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
