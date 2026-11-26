import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getStockGroup, isStockGroup, type StockGroup } from '@/lib/stock-groups';

const MAX_ITEMS = 50;

export interface TemplateInput {
  stockGroup: string;
  name: string;
  recipientUnit: string;
  storageLocation?: string | null;
  receiverName?: string | null;
  items: { productId: string; quantity: number }[];
}

const templateInclude = {
  items: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      productId: true,
      quantity: true,
      product: { select: { isActive: true } },
    },
  },
} satisfies Prisma.DistributionTemplateInclude;

function text(value: unknown, label: string, required = false) {
  const clean = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!clean) {
    if (required) throw new Error(`${label} wajib diisi.`);
    return null;
  }
  if (clean.length > 150) throw new Error(`${label} maksimal 150 karakter.`);
  return clean;
}

/** Paket distribusi: template tabel barang per unit penerima (mis. BAAK FSIP, LPPM, Prodi FTIK). */
export class DistributionTemplateService {
  /** Satu query SQL tunggal (LEFT JOIN + json_agg) untuk menghindari 3 round-trip berurutan Prisma ke database remote. */
  static async list(stockGroup: StockGroup) {
    return prisma.$queryRaw<
      {
        id: string;
        stockGroup: string;
        name: string;
        recipientUnit: string;
        storageLocation: string | null;
        receiverName: string | null;
        createdAt: Date;
        updatedAt: Date;
        items: { productId: string; quantity: number; product: { isActive: boolean } }[];
      }[]
    >`
      SELECT
        t.id,
        t."stockGroup",
        t.name,
        t."recipientUnit",
        t."storageLocation",
        t."receiverName",
        t."createdAt",
        t."updatedAt",
        COALESCE(
          json_agg(
            json_build_object(
              'productId', i."productId",
              'quantity', i.quantity,
              'product', json_build_object('isActive', p."isActive")
            )
            ORDER BY i."sortOrder" ASC
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM "DistributionTemplate" t
      LEFT JOIN "DistributionTemplateItem" i ON i."templateId" = t.id
      LEFT JOIN "Product" p ON p.id = i."productId"
      WHERE t."stockGroup" = ${stockGroup}
      GROUP BY t.id
      ORDER BY t.name ASC
    `;
  }

  private static async validate(input: TemplateInput) {
    if (!isStockGroup(input?.stockGroup)) throw new Error('Jenis stok tidak dikenal.');
    const group = getStockGroup(input.stockGroup);
    const name = text(input.name, 'Nama paket', true)!;
    const recipientUnit = text(input.recipientUnit, group.recipientLabel, true)!;
    const storageLocation = text(input.storageLocation, 'Tempat penyimpanan');
    const receiverName = text(input.receiverName, 'Nama penerima');

    const items = Array.isArray(input.items) ? input.items : [];
    if (items.length > MAX_ITEMS) throw new Error(`Maksimal ${MAX_ITEMS} barang per paket.`);
    const seen = new Set<string>();
    const clean = items.map((item, index) => {
      const quantity = Number(item?.quantity);
      if (!item?.productId) throw new Error(`Barang pada baris ${index + 1} belum dipilih.`);
      if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error(`Jumlah pada baris ${index + 1} tidak boleh negatif.`);
      if (seen.has(item.productId)) throw new Error(`Barang pada baris ${index + 1} dobel.`);
      seen.add(item.productId);
      return { productId: item.productId, quantity, sortOrder: index };
    });

    if (clean.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: clean.map((item) => item.productId) } },
        select: { id: true, name: true, category: { select: { stockGroup: true } } },
      });
      if (products.length !== clean.length) throw new Error('Salah satu barang tidak ditemukan.');
      const wrong = products.find((product) => (product.category?.stockGroup ?? 'ATK') !== group.id);
      if (wrong) throw new Error(`Barang "${wrong.name}" bukan termasuk jenis ${group.label}.`);
    }

    return { stockGroup: group.id, name, recipientUnit, storageLocation, receiverName, items: clean };
  }

  private static isDuplicateName(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  static async create(input: TemplateInput) {
    const data = await this.validate(input);
    try {
      return await prisma.distributionTemplate.create({
        data: {
          stockGroup: data.stockGroup,
          name: data.name,
          recipientUnit: data.recipientUnit,
          storageLocation: data.storageLocation,
          receiverName: data.receiverName,
          ...(data.items.length > 0 ? { items: { create: data.items } } : {}),
        },
        include: templateInclude,
      });
    } catch (error) {
      if (this.isDuplicateName(error)) throw new Error(`Paket bernama "${data.name}" sudah ada.`);
      throw error;
    }
  }

  /** Ganti isi paket dengan tabel terbaru (barang ditambah/dihapus, jumlah diubah). */
  static async update(id: string, input: TemplateInput) {
    const data = await this.validate(input);
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.distributionTemplate.findUnique({ where: { id } });
        if (!existing) throw new Error('Paket tidak ditemukan.');
        if (existing.stockGroup !== data.stockGroup) throw new Error('Jenis stok paket tidak boleh diubah.');
        await tx.distributionTemplateItem.deleteMany({ where: { templateId: id } });
        return tx.distributionTemplate.update({
          where: { id },
          data: {
            name: data.name,
            recipientUnit: data.recipientUnit,
            storageLocation: data.storageLocation,
            receiverName: data.receiverName,
            ...(data.items.length > 0 ? { items: { create: data.items } } : {}),
          },
          include: templateInclude,
        });
      });
    } catch (error) {
      if (this.isDuplicateName(error)) throw new Error(`Paket bernama "${data.name}" sudah ada.`);
      throw error;
    }
  }

  static async remove(id: string, replacementId?: string) {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "DistributionTemplate" WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new Error('Paket tidak ditemukan.');

      const accounts = await tx.user.findMany({
        where: { requestTemplateId: id },
        select: { id: true, name: true, divisionName: true },
        orderBy: { name: 'asc' },
      });
      if (accounts.length > 0) {
        if (!replacementId) return { accounts };
        const replacement = await tx.distributionTemplate.findFirst({
          where: { id: replacementId, stockGroup: 'ATK', NOT: { id } },
          select: { id: true },
        });
        if (!replacement) throw new Error('Pilih paket ATK pengganti yang tersedia.');
        await tx.user.updateMany({
          where: { requestTemplateId: id },
          data: { requestTemplateId: replacement.id },
        });
      }
      await tx.distributionTemplate.delete({ where: { id } });
      return { accounts };
    });
  }
}
