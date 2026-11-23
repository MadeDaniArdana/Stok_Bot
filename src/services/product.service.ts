import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeProductUnit } from '@/lib/product-units';
import { checkPackSetup } from '@/lib/unit-guard';
import type { StockGroup } from '@/lib/stock-groups';

export interface CreateProductInput {
  name: string;
  description?: string;
  categoryId: string;
  unit: string;
  minimumStock: number;
  initialStock: number;
  actorUserId?: string;
  receipt?: {
    notes?: string;
    referenceId?: string;
  };
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  categoryId?: string | null;
  unit?: string;
  minimumStock?: number;
  /** Mengaktifkan satuan kecil: satuan lama menjadi kemasan, 1 kemasan = packSize satuan kecil. */
  subUnit?: string;
  packSize?: number;
  /**
   * Untuk barang yang sudah berkemasan: ganti nama satuan kemasan (packUnit) dan/atau isinya (packSize).
   * Stok tetap tersimpan dalam satuan dasar, jadi hanya tampilan/konversi input yang berubah.
   */
  packUnit?: string;
  /** Hapus satuan kemasan; stok tetap dalam satuan dasar. */
  removePack?: boolean;
}

export interface ProductFilterOptions {
  search?: string;
  categoryId?: string;
  stockGroup?: StockGroup;
  status?: 'active' | 'inactive' | 'all';
  stockStatus?: 'all' | 'safe' | 'low' | 'empty';
  page?: number;
  limit?: number;
}

export class ProductService {
  static async getProducts(filters: ProductFilterOptions = {}) {
    const { search, categoryId, stockGroup, status = 'all', stockStatus = 'all', page = 1, limit = 50 } = filters;

    const where: any = {};

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    if (stockGroup) {
      where.category = { stockGroup };
    }

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { sku: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    // Filter status stok dibandingkan langsung dengan kolom minimumStock di database.
    const minimumStock = prisma.product.fields.minimumStock;
    if (stockStatus === 'empty') {
      where.currentStock = 0;
    } else if (stockStatus === 'low') {
      where.AND = [{ currentStock: { gt: 0 } }, { currentStock: { lte: minimumStock } }];
    } else if (stockStatus === 'safe') {
      where.currentStock = { gt: minimumStock };
    }

    const safePage = Math.max(1, page || 1);
    const safeLimit = Math.min(Math.max(1, limit || 50), 500);

    const [total, items] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { name: 'asc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
    ]);

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  static async getProductById(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            actor: {
              select: { id: true, name: true, role: true },
            },
          },
        },
      },
    });
  }

  static async createProduct(input: CreateProductInput) {
    const { name, description, categoryId, unit, minimumStock, initialStock, actorUserId, receipt } = input;

    if (!name || !name.trim()) throw new Error('Nama barang wajib diisi.');
    if (!categoryId || !categoryId.trim()) throw new Error('Kategori barang wajib dipilih.');
    if (!unit || !unit.trim()) throw new Error('Satuan dasar barang wajib diisi.');
    if (!Number.isSafeInteger(minimumStock) || minimumStock < 0) throw new Error('Stok minimum harus bilangan bulat yang tidak negatif.');
    if (!Number.isSafeInteger(initialStock) || initialStock < 0) throw new Error('Stok wajib diisi dengan bilangan bulat yang tidak negatif.');

    const product = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({ where: { id: categoryId } });
      if (!category) throw new Error('Kategori barang tidak ditemukan.');

      const sku = await this.generateSku(tx, category.name);
      const newProduct = await tx.product.create({
        data: {
          sku,
          name: name.trim(),
          description: description?.trim() || null,
          categoryId: category.id,
          unit: normalizeProductUnit(unit),
          currentStock: initialStock,
          minimumStock,
          isActive: true,
        },
      });

      if (initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: newProduct.id,
            actorUserId: actorUserId || null,
            type: 'IN',
            quantity: initialStock,
            stockBefore: 0,
            stockAfter: initialStock,
            source: receipt ? 'WEB' : 'SYSTEM',
            notes: receipt?.notes?.trim() || 'Saldo awal pembuatan master barang',
            referenceId: receipt?.referenceId?.trim() || null,
          },
        });
      }

      return newProduct;
    });

    return product;
  }

  static async updateProduct(id: string, input: UpdateProductInput) {
    if (input.unit !== undefined && !normalizeProductUnit(input.unit)) {
      throw new Error('Satuan dasar barang wajib diisi.');
    }
    if (
      input.minimumStock !== undefined &&
      (!Number.isSafeInteger(input.minimumStock) || input.minimumStock < 0)
    ) {
      throw new Error('Stok minimum harus bilangan bulat yang tidak negatif.');
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing) throw new Error('Barang tidak ditemukan.');

      let sku: string | undefined;
      if (input.categoryId !== undefined && input.categoryId !== existing.categoryId) {
        if (!input.categoryId) {
          if (existing.categoryId) throw new Error('Kategori barang tidak boleh dikosongkan.');
        } else {
          const category = await tx.category.findUnique({ where: { id: input.categoryId } });
          if (!category) throw new Error('Kategori barang tidak ditemukan.');
          sku = await this.generateSku(tx, category.name);
        }
      }

      // Barang yang sudah berkemasan: satuan dasar, satuan kemasan, dan isi per kemasan boleh diubah
      // tanpa mengonversi angka, karena stok & riwayat sudah tersimpan dalam satuan dasar.
      let packEdit: { packUnit: string | null; packSize: number | null } | undefined;
      if (existing.packSize) {
        const baseUnit = input.unit !== undefined ? normalizeProductUnit(input.unit) : existing.unit;
        if (input.removePack) {
          packEdit = { packUnit: null, packSize: null };
        } else if (input.packUnit !== undefined || input.packSize !== undefined || input.unit !== undefined) {
          const packUnit = input.packUnit !== undefined ? normalizeProductUnit(input.packUnit) : existing.packUnit || '';
          const packSize = input.packSize !== undefined ? input.packSize : existing.packSize;
          if (!packUnit) throw new Error('Satuan beli wajib diisi.');
          if (packUnit === baseUnit) throw new Error('Satuan beli harus berbeda dari satuan dasar.');
          if (!Number.isSafeInteger(packSize) || packSize < 2) throw new Error('Isi per satuan beli harus bilangan bulat minimal 2.');
          const check = checkPackSetup(packUnit, packSize, baseUnit);
          if (check.errors.length) throw new Error(check.errors[0]);
          packEdit = { packUnit, packSize };
        }
      }

      // Tambah kemasan besar untuk barang tanpa kemasan: satuan sekarang jadi satuan dasar, angka tidak dikonversi.
      if (!existing.packSize && !input.subUnit && input.packUnit && input.packSize !== undefined) {
        const baseUnit = input.unit !== undefined ? normalizeProductUnit(input.unit) : existing.unit;
        const packUnit = normalizeProductUnit(input.packUnit);
        const check = checkPackSetup(packUnit, input.packSize, baseUnit);
        if (check.errors.length) throw new Error(check.errors[0]);
        packEdit = { packUnit, packSize: input.packSize };
      }

      // Aktifkan satuan kecil: seluruh angka lama (dalam satuan lama) dikonversi ke satuan kecil.
      let pack: { unit: string; packUnit: string; packSize: number; minimumStock?: number } | undefined;
      if (!existing.packSize && input.subUnit && input.packSize !== undefined) {
        const subUnit = normalizeProductUnit(input.subUnit);
        const size = input.packSize;
        const newPackUnit = input.unit !== undefined ? normalizeProductUnit(input.unit) : existing.unit;
        if (!subUnit || subUnit === newPackUnit) throw new Error('Satuan dasar harus berbeda dari satuan beli.');
        if (!Number.isSafeInteger(size) || size < 2) throw new Error('Isi per satuan beli harus bilangan bulat minimal 2.');
        const check = checkPackSetup(input.unit !== undefined ? normalizeProductUnit(input.unit) : existing.unit, size, subUnit);
        if (check.errors.length) throw new Error(check.errors[0]);
        if (existing.currentStock * size > 2_000_000_000) throw new Error('Isi per kemasan terlalu besar.');
        await tx.stockMovement.updateMany({
          where: { productId: id },
          data: { quantity: { multiply: size }, stockBefore: { multiply: size }, stockAfter: { multiply: size } },
        });
        await tx.distributionTemplateItem.updateMany({ where: { productId: id }, data: { quantity: { multiply: size } } });
        await tx.installationTask.updateMany({ where: { productId: id }, data: { quantity: { multiply: size } } });
        await tx.product.update({ where: { id }, data: { currentStock: { multiply: size }, minimumStock: { multiply: size } } });
        pack = { unit: subUnit, packUnit: input.unit !== undefined ? normalizeProductUnit(input.unit) : existing.unit, packSize: size };
      }

      return tx.product.update({
        where: { id },
        data: {
          sku,
          name: input.name ? input.name.trim() : undefined,
          description: input.description !== undefined ? input.description?.trim() || null : undefined,
          categoryId: input.categoryId !== undefined ? input.categoryId : undefined,
          unit: input.unit !== undefined ? normalizeProductUnit(input.unit) : undefined,
          minimumStock: input.minimumStock !== undefined ? input.minimumStock * (pack?.packSize ?? 1) : undefined,
          // Ditaruh terakhir agar menimpa unit lama dari form.
          ...(packEdit && { packUnit: packEdit.packUnit, packSize: packEdit.packSize }),
          ...(pack && { unit: pack.unit, packUnit: pack.packUnit, packSize: pack.packSize }),
        },
      });
    });
  }

  private static async generateSku(
    client: Prisma.TransactionClient | typeof prisma,
    categoryName: string
  ): Promise<string> {
    const prefix =
      categoryName
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'KATEGORI';
    const existingProducts = await client.product.findMany({
      where: { sku: { startsWith: `${prefix}-` } },
      select: { sku: true },
    });
    const lastNumber = existingProducts.reduce((maximum, product) => {
      const match = product.sku.match(/-(\d+)$/);
      return match ? Math.max(maximum, Number(match[1])) : maximum;
    }, 0);

    return `${prefix}-${String(lastNumber + 1).padStart(3, '0')}`;
  }

  /**
   * Hapus barang permanen. Hanya untuk barang yang belum dipakai di dokumen distribusi atau tugas pemasangan,
   * agar laporan & bukti lama tetap utuh; riwayat stok (mis. stok awal) dan isi template ikut dihapus.
   */
  static async deleteProduct(id: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id }, select: { id: true, name: true } });
      if (!existing) throw new Error('Barang tidak ditemukan.');

      const [distributionCount, taskCount] = await Promise.all([
        tx.distributionItem.count({ where: { productId: id } }),
        tx.installationTask.count({ where: { productId: id } }),
      ]);
      if (distributionCount > 0 || taskCount > 0) {
        const usedIn = [
          distributionCount > 0 ? `${distributionCount} dokumen distribusi` : '',
          taskCount > 0 ? `${taskCount} tugas pemasangan` : '',
        ].filter(Boolean).join(' dan ');
        throw new Error(
          `Barang "${existing.name}" sudah tercatat di ${usedIn}, jadi tidak bisa dihapus agar laporan lama tetap utuh. Nonaktifkan barang ini saja.`
        );
      }

      await tx.stockMovement.deleteMany({ where: { productId: id } });
      await tx.distributionTemplateItem.deleteMany({ where: { productId: id } });
      await tx.notification.deleteMany({ where: { productId: id } });
      return tx.product.delete({ where: { id } });
    });
  }

  static async toggleStatus(id: string) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new Error('Barang tidak ditemukan.');

    return prisma.product.update({
      where: { id },
      data: {
        isActive: !existing.isActive,
      },
    });
  }
}
