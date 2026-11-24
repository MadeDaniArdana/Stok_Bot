import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DistributionService } from './distribution.service';

/** Divisi hanya mengajukan barang habis pakai; Peralatan Listrik punya alur pemasangan sendiri. */
export const REQUEST_GROUPS = ['ATK', 'LOGISTIK'] as const;
const MAX_ITEMS = 50;

const include = {
  items: { include: { product: { select: { id: true, name: true, unit: true } } }, orderBy: { id: 'asc' as const } },
} satisfies Prisma.ItemRequestInclude;

interface Actor {
  id: string;
  name: string;
}

export class RequestService {
  static async create(user: Actor, input: { stockGroup: string; notes?: string | null; items: { productId: string; quantity: number }[] }) {
    if (!(REQUEST_GROUPS as readonly string[]).includes(input.stockGroup)) throw new Error('Jenis barang tidak valid.');
    const rawItems = Array.isArray(input.items) ? input.items : [];
    if (rawItems.length === 0) throw new Error('Tambahkan minimal satu barang.');
    if (rawItems.length > MAX_ITEMS) throw new Error(`Maksimal ${MAX_ITEMS} barang per pengajuan.`);

    const seen = new Set<string>();
    const items = rawItems.map((item, index) => {
      const quantity = Number(item?.quantity);
      if (!item?.productId) throw new Error(`Barang pada baris ${index + 1} belum dipilih.`);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error(`Jumlah pada baris ${index + 1} harus bilangan bulat lebih dari nol.`);
      if (seen.has(item.productId)) throw new Error(`Barang pada baris ${index + 1} sudah ada di baris lain.`);
      seen.add(item.productId);
      return { productId: item.productId, quantity };
    });

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((i) => i.productId) } },
      include: { category: { select: { stockGroup: true } } },
    });
    if (products.length !== items.length) throw new Error('Salah satu barang tidak ditemukan.');
    for (const p of products) {
      if (!p.isActive || (p.category?.stockGroup ?? 'ATK') !== input.stockGroup) {
        throw new Error(`Barang "${p.name}" tidak tersedia untuk diajukan.`);
      }
    }

    const notes = typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim().slice(0, 500) : null;
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).format(new Date()).replace('-', '');
    const prefix = `PJ-${month}-`;

    for (let attempt = 0; ; attempt += 1) {
      try {
        const last = await prisma.itemRequest.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: 'desc' }, select: { number: true } });
        const next = (last ? Number(last.number.slice(prefix.length)) || 0 : 0) + 1;
        return await prisma.itemRequest.create({
          data: {
            number: `${prefix}${String(next).padStart(3, '0')}`,
            stockGroup: input.stockGroup,
            requesterId: user.id,
            requesterName: user.name,
            divisionName: user.name,
            notes,
            items: { create: items },
          },
          include,
        });
      } catch (error) {
        // Nomor bentrok karena dua pengajuan masuk bersamaan: coba lagi dengan nomor berikutnya.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && attempt < 3) continue;
        throw error;
      }
    }
  }

  static listMine(userId: string) {
    return prisma.itemRequest.findMany({ where: { requesterId: userId }, orderBy: { createdAt: 'desc' }, take: 100, include });
  }

  /** incoming = menunggu keputusan; history = sudah disetujui/ditolak. */
  static list(view: 'incoming' | 'history') {
    return prisma.itemRequest.findMany({
      where: { status: view === 'incoming' ? { in: ['PENDING', 'PROCESSING'] } : { in: ['APPROVED', 'REJECTED'] } },
      orderBy: view === 'incoming' ? { createdAt: 'asc' } : { decidedAt: 'desc' },
      take: 200,
      include,
    });
  }

  /** Setujui = buat dokumen Distribusi (stok berkurang + tercatat di laporan distribusi). */
  static async approve(id: string, admin: Actor) {
    // Klaim atomik: dua admin menekan Setujui bersamaan tidak akan mengurangi stok dua kali.
    const claimed = await prisma.itemRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PROCESSING' } });
    if (claimed.count === 0) throw new Error('Pengajuan tidak ditemukan atau sudah diproses.');
    const request = await prisma.itemRequest.findUniqueOrThrow({ where: { id }, include: { items: true } });

    let distribution;
    try {
      ({ distribution } = await DistributionService.create({
        stockGroup: request.stockGroup,
        recipientUnit: request.divisionName,
        orderNumber: request.number,
        receiverName: request.requesterName,
        handoverName: admin.name,
        notes: `Pengajuan ${request.number}${request.notes ? `: ${request.notes}` : ''}`,
        items: request.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        actorUserId: admin.id,
      }));
    } catch (error) {
      // Gagal (mis. stok kurang): kembalikan ke antrean supaya bisa dicoba lagi atau ditolak.
      await prisma.itemRequest.update({ where: { id }, data: { status: 'PENDING' } });
      throw error;
    }
    return prisma.itemRequest.update({
      where: { id },
      data: { status: 'APPROVED', decidedAt: new Date(), decidedByName: admin.name, distributionId: distribution.id, distributionNumber: distribution.number },
      include,
    });
  }

  static async reject(id: string, reason: string, admin: Actor) {
    const text = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';
    if (!text) throw new Error('Alasan penolakan wajib diisi.');
    const done = await prisma.itemRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', rejectReason: text, decidedAt: new Date(), decidedByName: admin.name },
    });
    if (done.count === 0) throw new Error('Pengajuan tidak ditemukan atau sudah diproses.');
    return prisma.itemRequest.findUniqueOrThrow({ where: { id }, include });
  }
}
