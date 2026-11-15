import { prisma } from '@/lib/prisma';

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  unit: string;
  minimumStock: number;
  initialStock?: number;
  actorUserId?: string;
}

export interface UpdateProductInput {
  sku?: string;
  name?: string;
  description?: string;
  categoryId?: string;
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
        { name: { contains: search.trim() } },
        { sku: { contains: search.trim() } },
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
    const { sku, name, description, categoryId, unit, minimumStock, initialStock = 0, actorUserId } = input;

    if (!sku || !sku.trim()) throw new Error('Kode SKU wajib diisi.');
    if (!name || !name.trim()) throw new Error('Nama barang wajib diisi.');
    if (!unit || !unit.trim()) throw new Error('Satuan dasar barang wajib diisi.');
    if (minimumStock < 0) throw new Error('Stok minimum tidak boleh negatif.');
    if (initialStock < 0) throw new Error('Stok awal tidak boleh negatif.');

    // Cek SKU unik
    const existingSku = await prisma.product.findUnique({
      where: { sku: sku.trim().toUpperCase() },
    });

    if (existingSku) {
      throw new Error(`Barang dengan kode SKU "${sku.trim().toUpperCase()}" sudah terdaftar.`);
    }

    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          description: description?.trim() || null,
          categoryId: categoryId || null,
          unit: unit.trim().toLowerCase(),
          currentStock: initialStock,
          minimumStock: minimumStock || 0,
          isActive: true,
        },
      });

      // Jika ada saldo awal, catat sebagai stock movement
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
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new Error('Barang tidak ditemukan.');

    if (input.sku && input.sku.trim().toUpperCase() !== existing.sku) {
      const duplicate = await prisma.product.findUnique({
        where: { sku: input.sku.trim().toUpperCase() },
      });
      if (duplicate) {
        throw new Error(`Kode SKU "${input.sku.trim().toUpperCase()}" sudah digunakan oleh barang lain.`);
      }
    }

    return prisma.product.update({
      where: { id },
      data: {
        sku: input.sku ? input.sku.trim().toUpperCase() : undefined,
        name: input.name ? input.name.trim() : undefined,
        description: input.description !== undefined ? input.description?.trim() || null : undefined,
        categoryId: input.categoryId !== undefined ? input.categoryId || null : undefined,
        unit: input.unit ? input.unit.trim().toLowerCase() : undefined,
        minimumStock: input.minimumStock !== undefined ? input.minimumStock : undefined,
      },
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
