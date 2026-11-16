import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { NotificationService } from './notification.service';
import { logError } from '@/lib/error-log';
import { saveTaskProof, deleteTaskProof } from '@/lib/task-proof-storage';

const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export class InstallationTaskService {
  static async create(params: {
    productId: string;
    quantity: number;
    assigneeName: string;
    location: string;
    notes?: string;
    creatorUserId: string;
  }) {
    const { productId, quantity, assigneeName, location, notes, creatorUserId } = params;

    if (!productId || !creatorUserId) throw new Error('Barang dan admin pembuat tugas wajib diisi.');
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Jumlah harus bilangan bulat positif.');
    if (!assigneeName.trim() || !location.trim()) throw new Error('Nama pemasang dan lokasi wajib diisi.');

    const token = randomBytes(32).toString('hex');
    const task = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product || !product.isActive) throw new Error('Barang tidak ditemukan atau tidak aktif.');

      const pendingTasks = await tx.installationTask.aggregate({
        where: { productId, status: 'PENDING' },
        _sum: { quantity: true },
      });
      const committedPendingQuantity = pendingTasks._sum.quantity || 0;
      const availableStock = product.currentStock - committedPendingQuantity;
      if (availableStock < quantity) {
        throw new Error(`Stok tersedia untuk tugas baru hanya ${Math.max(availableStock, 0)} ${product.unit}.`);
      }

      return tx.installationTask.create({
        data: {
          productId,
          creatorUserId,
          quantity,
          assigneeName: assigneeName.trim(),
          location: location.trim(),
          notes: notes?.trim() || null,
          tokenHash: hashToken(token),
        },
        include: { product: true },
      });
    });

    return { task, token };
  }

  static async getByToken(token: string) {
    if (!TOKEN_PATTERN.test(token)) return null;
    return prisma.installationTask.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { product: true },
    });
  }

  static async completeWithProof(token: string, file: File) {
    if (!TOKEN_PATTERN.test(token)) throw new Error('Link tugas tidak valid.');

    const initialTask = await this.getByToken(token);
    if (!initialTask) throw new Error('Tugas tidak ditemukan.');
    if (initialTask.status === 'COMPLETED') throw new Error('Bukti untuk tugas ini sudah pernah dikirim.');

    const proofFileName = await saveTaskProof(file);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const task = await tx.installationTask.findUnique({
          where: { tokenHash: hashToken(token) },
          include: { product: true },
        });

        if (!task) throw new Error('Tugas tidak ditemukan.');
        if (task.status !== 'PENDING') throw new Error('Tugas ini sudah selesai.');
        if (!task.product.isActive) throw new Error('Barang sudah tidak aktif.');
        if (task.product.currentStock < task.quantity) {
          throw new Error(`Stok ${task.product.name} tidak mencukupi untuk menyelesaikan tugas ini.`);
        }

        const stockBefore = task.product.currentStock;
        const stockAfter = stockBefore - task.quantity;
        const stockUpdate = await tx.product.updateMany({
          where: { id: task.productId, currentStock: { gte: task.quantity } },
          data: { currentStock: { decrement: task.quantity } },
        });
        if (stockUpdate.count !== 1) throw new Error('Stok berubah atau tidak mencukupi. Silakan hubungi admin.');

        const completedAt = new Date();
        const taskUpdate = await tx.installationTask.updateMany({
          where: { id: task.id, status: 'PENDING' },
          data: {
            status: 'COMPLETED',
            proofFileName,
            proofMimeType: file.type,
            completedAt,
          },
        });
        if (taskUpdate.count !== 1) throw new Error('Tugas ini sudah selesai.');

        await tx.stockMovement.create({
          data: {
            productId: task.productId,
            actorUserId: task.creatorUserId,
            type: 'OUT',
            quantity: task.quantity,
            stockBefore,
            stockAfter,
            source: 'WEB',
            referenceId: task.id,
            notes: `Pemasangan oleh ${task.assigneeName} di ${task.location}${task.notes ? `. ${task.notes}` : ''}`,
          },
        });

        return {
          task: {
            ...task,
            status: 'COMPLETED',
            proofFileName,
            proofMimeType: file.type,
            completedAt,
          },
          stockAfter,
        };
      });

      try {
        await NotificationService.checkStockLevelAndAlert(
          result.task.productId,
          result.stockAfter,
          result.task.creatorUserId
        );
      } catch (error) {
        await logError({
          source: 'NOTIFICATION',
          error,
          location: 'Notifikasi stok menipis setelah tugas selesai',
          context: { tugasId: result.task.id, barang: result.task.product.name, stokSesudah: result.stockAfter },
        });
      }

      try {
        await NotificationService.notifyTaskCompleted({
          creatorUserId: result.task.creatorUserId,
          productName: result.task.product.name,
          quantity: result.task.quantity,
          unit: result.task.product.unit,
          assigneeName: result.task.assigneeName,
          location: result.task.location,
          stockAfter: result.stockAfter,
          proofReference: result.task.proofFileName,
          proofMimeType: result.task.proofMimeType,
        });
      } catch (error) {
        await logError({
          source: 'NOTIFICATION',
          error,
          location: 'Pesan "tugas selesai" ke admin Telegram',
          context: { tugasId: result.task.id, barang: result.task.product.name, pemasang: result.task.assigneeName },
        });
      }

      return result.task;
    } catch (error) {
      await deleteTaskProof(proofFileName);
      throw error;
    }
  }
}
