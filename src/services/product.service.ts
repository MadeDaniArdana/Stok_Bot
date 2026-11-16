import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface CreateProductInput {
  name: string;
  description?: string;
  categoryId: string;
  unit: string;
  minimumStock: number;
  initialStock: number;
  actorUserId?: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  categoryId?: string | null;
  unit?: string;
  minimumStock?: number;
}

export interface ProductFilterOptions {
  search?: string;
  categoryId?: string;
  status?: 'active' | 'inactive' | 'all';
  stockStatus?: 'all' | 'safe' | 'low' | 'empty';
  page?: number;
  limit?: number;
}

export class ProductService {
  static async getProducts(filters: ProductFilterOptions = {}) {
    const { search, categoryId, status = 'all', stockStatus = 'all', page = 1, limit = 50 } = filters;

    const where: any = {};

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { sku: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const allProducts = await prisma.product.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });

    // Filter by stockStatus in memory for precision
    let filtered = allProducts;
    if (stockStatus === 'empty') {
      filtered = allProducts.filter((p) => p.currentStock === 0);
    } else if (stockStatus === 'low') {
      filtered = allProducts.filter((p) => p.currentStock > 0 && p.currentStock <= p.minimumStock);
    } else if (stockStatus === 'safe') {
      filtered = allProducts.filter((p) => p.currentStock > p.minimumStock);
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const items = filtered.slice(startIndex, startIndex + limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
    const { name, description, categoryId, unit, minimumStock, initialStock, actorUserId } = input;

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
          unit: unit.trim().toLowerCase(),
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
            source: 'SYSTEM',
            notes: 'Saldo awal pembuatan master barang',
          },
        });
      }

      return newProduct;
    });

    return product;
  }

  static async updateProduct(id: string, input: UpdateProductInput) {
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

      return tx.product.update({
        where: { id },
        data: {
          sku,
          name: input.name ? input.name.trim() : undefined,
          description: input.description !== undefined ? input.description?.trim() || null : undefined,
          categoryId: input.categoryId !== undefined ? input.categoryId : undefined,
          unit: input.unit ? input.unit.trim().toLowerCase() : undefined,
          minimumStock: input.minimumStock !== undefined ? input.minimumStock : undefined,
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
