import { prisma } from '@/lib/prisma';
import { MovementSource, MovementType } from '@/types';
import { NotificationService } from './notification.service';
import { formatStock } from '@/lib/product-units';

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

export interface AdjustmentParams {
  productId: string;
  /** Stok fisik hasil hitung ulang, dalam satuan dasar barang. */
  actualStock: number;
  reason: string;
  actorUserId?: string | null;
}

export class InventoryService {
  /**
   * Penyesuaian stok (stok opname): samakan stok sistem dengan hasil hitung fisik.
   * Dicatat sebagai movement ADJUSTMENT (selisih +/-) sehingga riwayat & laporan bulanan tetap konsisten.
   */
  static async recordAdjustment(params: AdjustmentParams) {
    const { productId, actualStock, reason, actorUserId } = params;

    if (!productId) throw new Error('ID Barang wajib diisi.');
    if (!Number.isSafeInteger(actualStock) || actualStock < 0) {
      throw new Error('Stok sebenarnya harus bilangan bulat 0 atau lebih.');
    }
    if (!reason || !reason.trim()) throw new Error('Alasan penyesuaian wajib diisi.');

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error('Barang tidak ditemukan.');

      const stockBefore = product.currentStock;
      const diff = actualStock - stockBefore;
      if (diff === 0) throw new Error('Stok sebenarnya sama dengan stok sistem, tidak ada yang perlu disesuaikan.');

      // Kunci optimistis: gagal jika stok berubah oleh transaksi lain di antara baca & tulis.
      const updated = await tx.product.updateMany({
        where: { id: productId, currentStock: stockBefore },
        data: { currentStock: actualStock },
      });
      if (updated.count === 0) throw new Error('Stok barang baru saja berubah. Muat ulang lalu coba lagi.');

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          actorUserId: actorUserId || null,
          type: 'ADJUSTMENT',
          quantity: Math.abs(diff),
          stockBefore,
          stockAfter: actualStock,
          source: 'WEB',
          notes: `Penyesuaian stok (${diff > 0 ? '+' : '-'}${formatStock(product, Math.abs(diff))}). Alasan: ${reason.trim()}`,
        },
      });

      return { movement, stockBefore, stockAfter: actualStock, diff };
    });

    await NotificationService.checkStockLevelAndAlert(productId, result.stockAfter, actorUserId);
    return result;
  }

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
          `Jumlah yang diminta (${formatStock(product, quantity)}) melebihi stok tersedia (${formatStock(product, product.currentStock)}).`
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

      const existingReversal = await tx.stockMovement.findFirst({
        where: { type: 'REVERSAL', referenceId: original.id },
        select: { id: true },
      });
      if (existingReversal) {
        throw new Error('Transaksi ini sudah pernah dikoreksi sehingga tidak dapat dibalik dua kali.');
      }

      if (original.type === 'OUT' && original.referenceId) {
        const distribution = await tx.distribution.findUnique({
          where: { id: original.referenceId },
          select: { number: true },
        });
        if (distribution) {
          throw new Error(
            `Barang keluar ini bagian dari dokumen distribusi ${distribution.number}. Batalkan dokumennya di menu Laporan > Laporan Distribusi.`
          );
        }
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
