import { prisma } from '@/lib/prisma';
import { MovementSource, MovementType } from '@/types';
import { NotificationService } from './notification.service';

export interface StockInParams {
  productId: string;
  quantity: number;
  actorUserId?: string | null;
  source?: MovementSource;
  notes?: string;
  referenceId?: string;
}

export interface StockOutParams {
  productId: string;
  quantity: number;
  actorUserId?: string | null;
  source?: MovementSource;
  notes?: string;
  telegramUpdateId?: string;
  referenceId?: string;
}

export interface ReversalParams {
  originalMovementId: string;
  actorUserId?: string | null;
  reason: string;
}

export class InventoryService {
  /**
   * Catat Barang Masuk (Stock In)
   * Dilakukan dalam 1 transaksi atomik
   */
  static async recordStockIn(params: StockInParams) {
    const { productId, quantity, actorUserId, source = 'WEB', notes, referenceId } = params;

    if (!productId) {
      throw new Error('ID Barang wajib diisi.');
    }

    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new Error('Jumlah barang masuk harus bilangan bulat positif lebih besar dari nol.');
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Ambil data produk
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error('Barang tidak ditemukan.');
      }

      if (!product.isActive) {
        throw new Error('Barang ini berstatus nonaktif dan tidak dapat menerima transaksi.');
      }

      const stockBefore = product.currentStock;
      const stockAfter = stockBefore + quantity;

      // 2. Perbarui stok produk
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          currentStock: stockAfter,
        },
      });

      // 3. Catat di ledger stock movement
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          actorUserId: actorUserId || null,
          type: 'IN',
          quantity,
          stockBefore,
          stockAfter,
          source,
          notes: notes?.trim() || 'Barang Masuk',
          referenceId: referenceId || null,
        },
      });

      return { product: updatedProduct, movement };
    });

    return result;
  }

  /**
   * Catat Barang Keluar (Stock Out)
   * Dilakukan secara atomik dengan conditional check untuk mencegah stok negatif
   */
  static async recordStockOut(params: StockOutParams) {
    const { productId, quantity, actorUserId, source = 'WEB', notes, telegramUpdateId, referenceId } = params;

    if (!productId) {
      throw new Error('ID Barang wajib diisi.');
    }

    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new Error('Jumlah barang keluar harus bilangan bulat positif lebih besar dari nol.');
    }

    // Cek duplikasi Telegram Update jika ada
    if (telegramUpdateId) {
      const existingMovement = await prisma.stockMovement.findUnique({
        where: { telegramUpdateId },
      });
      if (existingMovement) {
        throw new Error(`Transaksi dengan update_id ${telegramUpdateId} sudah pernah diproses.`);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error('Barang tidak ditemukan.');
      }

      if (!product.isActive) {
        throw new Error('Barang ini dinonaktifkan dan tidak dapat diambil.');
      }

      if (product.currentStock < quantity) {
        throw new Error(
          `Jumlah yang diminta (${quantity} ${product.unit}) melebihi stok tersedia (${product.currentStock} ${product.unit}).`
        );
      }

      const stockBefore = product.currentStock;
      const stockAfter = stockBefore - quantity;

      // Conditional decrement
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          currentStock: stockAfter,
        },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          actorUserId: actorUserId || null,
          type: 'OUT',
          quantity,
          stockBefore,
          stockAfter,
          source,
          telegramUpdateId: telegramUpdateId || null,
          notes: notes?.trim() || 'Barang Keluar',
          referenceId: referenceId || null,
        },
      });

      return { product: updatedProduct, movement, stockAfter };
    });

    // Check low stock alert post-commit
    await NotificationService.checkStockLevelAndAlert(productId, result.stockAfter, actorUserId);

    return result;
  }

  /**
   * Koreksi / Pembalik Transaksi (Reversal)
   * Sesuai PRD: Transaksi tidak dihapus permanen, tetapi dikoreksi dengan movement REVERSAL
   */
  static async reverseMovement(params: ReversalParams) {
    const { originalMovementId, actorUserId, reason } = params;

    if (!reason || !reason.trim()) {
      throw new Error('Alasan pembalik transaksi wajib diisi.');
    }

    const result = await prisma.$transaction(async (tx) => {
      const original = await tx.stockMovement.findUnique({
        where: { id: originalMovementId },
        include: { product: true },
      });

      if (!original) {
        throw new Error('Transaksi movement asal tidak ditemukan.');
      }

      if (original.type === 'REVERSAL') {
        throw new Error('Transaksi pembalik tidak dapat dibalik ulang.');
      }

      const product = original.product;
      let stockAfter = product.currentStock;

      if (original.type === 'IN') {
        // Jika asalnya IN, reversal berarti mengurangi stok kembali
        if (product.currentStock < original.quantity) {
          throw new Error(
            `Tidak dapat membalik transaksi masuk: Stok saat ini (${product.currentStock}) tidak cukup untuk dikurangi ${original.quantity}.`
          );
        }
        stockAfter = product.currentStock - original.quantity;
      } else if (original.type === 'OUT') {
        // Jika asalnya OUT, reversal berarti mengembalikan stok
        stockAfter = product.currentStock + original.quantity;
      } else {
        throw new Error('Hanya transaksi IN atau OUT yang dapat dibalik secara otomatis.');
      }

      const stockBefore = product.currentStock;

      await tx.product.update({
        where: { id: product.id },
        data: { currentStock: stockAfter },
      });

      const reversalMovement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          actorUserId: actorUserId || null,
          type: 'REVERSAL',
          quantity: original.quantity,
          stockBefore,
          stockAfter,
          source: 'WEB',
          referenceId: original.id,
          notes: `Koreksi atas transaksi #${original.id.slice(0, 8)}. Alasan: ${reason.trim()}`,
        },
      });

      return { reversalMovement, stockAfter, productId: product.id };
    });

    await NotificationService.checkStockLevelAndAlert(result.productId, result.stockAfter, actorUserId);

    return result;
  }
}
