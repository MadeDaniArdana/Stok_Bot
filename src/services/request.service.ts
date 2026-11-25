import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DistributionService } from './distribution.service';

/** Untuk saat ini pengajuan divisi hanya untuk ATK (formulir F-RUT-0204); Logistik & Peralatan Listrik punya alur sendiri. */
export const REQUEST_GROUPS = ['ATK'] as const;
const MAX_ITEMS = 50;
const TEXT_LIMIT = 150;
const SIGNATURE_PATTERN = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const MAX_SIGNATURE_LENGTH = 300_000;

/** Kolom untuk daftar/riwayat: sengaja tanpa tanda tangan (besar), yang hanya dibaca halaman cetak. */
const requestSelect = {
  id: true,
  number: true,
  stockGroup: true,
  requesterId: true,
  requesterName: true,
  divisionName: true,
  receiverName: true,
  notes: true,
  status: true,
  rejectReason: true,
  decidedAt: true,
  decidedByName: true,
  distributionId: true,
  distributionNumber: true,
  approvedDate: true,
  storageLocation: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      customName: true,
      customUnit: true,
      quantity: true,
      approvedQuantity: true,
      noStock: true,
      product: { select: { id: true, name: true, unit: true, packUnit: true, packSize: true } },
    },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.ItemRequestSelect;

interface Actor {
  id: string;
  name: string;
}

export interface CreateRequestInput {
  stockGroup: string;
  notes?: string | null;
  /** "Kepada": unit tujuan, dipilih dari paket distribusi atau ketik nama baru. */
  recipientTo: string;
  /** Nama penerima/pengaju yang menandatangani. */
  receiverName: string;
  /** Tanda tangan digital (PNG data URL). */
  signature: string;
  items: { productId?: string | null; name?: string | null; unit?: string | null; quantity: number }[];
}

export interface ApproveRequestInput {
  /** Jumlah ACC per baris; baris yang tidak dikirim memakai jumlah pengajuan. */
  items?: { id: string; approvedQuantity?: number; productId?: string | null; noStock?: boolean }[];
  /** Tanggal ACC (YYYY-MM-DD, WIB); kosong = hari ini. */
  date?: string | null;
  storageLocation?: string | null;
  adminSignature?: string | null;
}

function text(value: unknown, label: string, required = false, limit = TEXT_LIMIT): string | null {
  const cleaned = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!cleaned) {
    if (required) throw new Error(`${label} wajib diisi.`);
    return null;
  }
  if (cleaned.length > limit) throw new Error(`${label} maksimal ${limit} karakter.`);
  return cleaned;
}

function signature(value: unknown, required: boolean): string | null {
  if (typeof value !== 'string' || !value) {
    if (required) throw new Error('Tanda tangan digital wajib diisi.');
    return null;
  }
  if (value.length > MAX_SIGNATURE_LENGTH || !SIGNATURE_PATTERN.test(value)) throw new Error('Tanda tangan tidak valid. Silakan goreskan ulang.');
  return value;
}

function parseApprovalDate(value: string | null | undefined): Date {
  if (!value) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Tanggal ACC tidak valid.');
  const date = new Date(`${value}T12:00:00+07:00`);
  const year = Number(value.slice(0, 4));
  if (Number.isNaN(date.getTime()) || year < 2020 || year > 2100) throw new Error('Tanggal ACC tidak valid.');
  return date;
}

export class RequestService {
  static async create(user: Actor, input: CreateRequestInput) {
    const stockGroup = input.stockGroup || 'ATK';
    if (!(REQUEST_GROUPS as readonly string[]).includes(stockGroup)) throw new Error('Pengajuan barang saat ini hanya tersedia untuk ATK.');
    const recipientTo = text(input.recipientTo, 'Kolom "Kepada"', true)!;
    const receiverName = text(input.receiverName, 'Nama', true, 100)!;
    const requesterSignature = signature(input.signature, true);

    const rawItems = Array.isArray(input.items) ? input.items : [];
    if (rawItems.length === 0) throw new Error('Tambahkan minimal satu barang.');
    if (rawItems.length > MAX_ITEMS) throw new Error(`Maksimal ${MAX_ITEMS} barang per pengajuan.`);

    const seen = new Set<string>();
    const items = rawItems.map((item, index) => {
      const quantity = Number(item?.quantity);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error(`Jumlah pada baris ${index + 1} harus bilangan bulat lebih dari nol.`);
      if (item?.productId) {
        if (seen.has(item.productId)) throw new Error(`Barang pada baris ${index + 1} sudah ada di baris lain.`);
        seen.add(item.productId);
        return { productId: item.productId, quantity };
      }
      const customName = text(item?.name, `Nama barang baris ${index + 1}`, true)!;
      const customUnit = text(item?.unit, `Satuan baris ${index + 1}`, false, 30) ?? 'Pcs';
      return { productId: null, customName, customUnit, quantity };
    });

    const productIds = items.flatMap((i) => (i.productId ? [i.productId] : []));
    if (productIds.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { category: { select: { stockGroup: true } } },
      });
      if (products.length !== productIds.length) throw new Error('Salah satu barang tidak ditemukan.');
      for (const p of products) {
        if (!p.isActive || (p.category?.stockGroup ?? 'ATK') !== stockGroup) {
          throw new Error(`Barang "${p.name}" tidak tersedia untuk diajukan.`);
        }
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
            stockGroup,
            requesterId: user.id,
            requesterName: user.name,
            divisionName: recipientTo,
            receiverName,
            requesterSignature,
            notes,
            items: { create: items },
          },
          select: requestSelect,
        });
      } catch (error) {
        // Nomor bentrok karena dua pengajuan masuk bersamaan: coba lagi dengan nomor berikutnya.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && attempt < 3) continue;
        throw error;
      }
    }
  }

  static listMine(userId: string) {
    return prisma.itemRequest.findMany({ where: { requesterId: userId }, orderBy: { createdAt: 'desc' }, take: 100, select: requestSelect });
  }

  /** incoming = menunggu keputusan; history = sudah disetujui/ditolak. */
  static list(view: 'incoming' | 'history') {
    return prisma.itemRequest.findMany({
      where: { status: view === 'incoming' ? { in: ['PENDING', 'PROCESSING'] } : { in: ['APPROVED', 'REJECTED'] } },
      orderBy: view === 'incoming' ? { createdAt: 'asc' } : { decidedAt: 'desc' },
      take: 200,
      select: requestSelect,
    });
  }

  /** Untuk halaman cetak (memuat tanda tangan). */
  static getForPrint(id: string) {
    return prisma.itemRequest.findUnique({
      where: { id },
      select: {
        ...requestSelect,
        requesterSignature: true,
        adminSignature: true,
        items: {
          select: {
            ...requestSelect.items.select,
            product: { select: { id: true, name: true, unit: true, packUnit: true, packSize: true } },
          },
          orderBy: { id: 'asc' as const },
        },
      },
    });
  }

  /**
   * Setujui dengan jumlah ACC yang ditentukan admin. Barang master yang ACC > 0 dibuatkan dokumen Distribusi
   * (stok berkurang, tanggal = tanggal ACC). Barang ketikan pengaju harus dipetakan ke barang master atau ditandai "tanpa stok".
   */
  static async approve(id: string, admin: Actor, input: ApproveRequestInput = {}) {
    // Klaim atomik: dua admin menekan Setujui bersamaan tidak akan mengurangi stok dua kali.
    const claimed = await prisma.itemRequest.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PROCESSING' } });
    if (claimed.count === 0) throw new Error('Pengajuan tidak ditemukan atau sudah diproses.');

    try {
      const request = await prisma.itemRequest.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { id: 'asc' } } } });
      const approvedAt = parseApprovalDate(input.date);
      const dateText = input.date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
      const storageLocation = text(input.storageLocation, 'Tempat penyimpanan');
      const adminSignature = signature(input.adminSignature, false);
      const overrides = new Map((Array.isArray(input.items) ? input.items : []).map((item) => [item.id, item]));

      // Tentukan keputusan tiap baris.
      const decisions = request.items.map((item, index) => {
        const override = overrides.get(item.id);
        const approved = override?.approvedQuantity === undefined ? item.quantity : Number(override.approvedQuantity);
        if (!Number.isSafeInteger(approved) || approved < 0) throw new Error(`Jumlah ACC baris ${index + 1} harus bilangan bulat 0 atau lebih.`);
        const productId = item.productId ?? override?.productId ?? null;
        const noStock = !item.productId && !productId && approved > 0 ? Boolean(override?.noStock) : false;
        if (!productId && approved > 0 && !noStock) {
          throw new Error(`Barang "${item.customName ?? `baris ${index + 1}`}" belum dipetakan ke barang master. Pilih barangnya atau tandai "tanpa stok".`);
        }
        return { id: item.id, approved, productId, noStock };
      });

      // Gabungkan barang master yang sama (distribusi tidak boleh memuat baris ganda).
      const totals = new Map<string, number>();
      for (const d of decisions) if (d.productId && d.approved > 0) totals.set(d.productId, (totals.get(d.productId) ?? 0) + d.approved);

      let distribution: { id: string; number: string } | null = null;
      if (totals.size > 0) {
        ({ distribution } = await DistributionService.create({
          stockGroup: request.stockGroup,
          recipientUnit: request.divisionName,
          orderNumber: request.number,
          date: dateText,
          allowFutureDate: true,
          storageLocation,
          receiverName: request.receiverName ?? request.requesterName,
          handoverName: admin.name,
          notes: `Pengajuan ${request.number}${request.notes ? `: ${request.notes}` : ''}`,
          items: Array.from(totals, ([productId, quantity]) => ({ productId, quantity })),
          actorUserId: admin.id,
        }));
      }

      return await prisma.$transaction(async (tx) => {
        for (const d of decisions) {
          await tx.itemRequestItem.update({
            where: { id: d.id },
            data: { approvedQuantity: d.approved, productId: d.productId, noStock: d.noStock },
          });
        }
        return tx.itemRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            decidedAt: new Date(),
            decidedByName: admin.name,
            approvedDate: approvedAt,
            storageLocation,
            adminSignature,
            distributionId: distribution?.id ?? null,
            distributionNumber: distribution?.number ?? null,
          },
          select: requestSelect,
        });
      });
    } catch (error) {
      // Gagal (mis. stok kurang): kembalikan ke antrean supaya bisa dicoba lagi atau ditolak.
      await prisma.itemRequest.update({ where: { id }, data: { status: 'PENDING' } });
      throw error;
    }
  }

  static async reject(id: string, reason: string, admin: Actor) {
    const text = typeof reason === 'string' ? reason.trim().slice(0, 300) : '';
    if (!text) throw new Error('Alasan penolakan wajib diisi.');
    const done = await prisma.itemRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', rejectReason: text, decidedAt: new Date(), decidedByName: admin.name },
    });
    if (done.count === 0) throw new Error('Pengajuan tidak ditemukan atau sudah diproses.');
    return prisma.itemRequest.findUniqueOrThrow({ where: { id }, select: requestSelect });
  }
}
