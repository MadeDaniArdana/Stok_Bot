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
  static list(stockGroup: StockGroup) {
    return prisma.distributionTemplate.findMany({
      where: { stockGroup },
      orderBy: { name: 'asc' },
      include: templateInclude,
    });
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

  static async remove(id: string) {
    const deleted = await prisma.distributionTemplate.deleteMany({ where: { id } });
    if (deleted.count === 0) throw new Error('Paket tidak ditemukan.');
  }
}
