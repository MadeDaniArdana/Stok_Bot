import { createHash, randomBytes, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getReportMonthRange } from '@/lib/report-period';
import { getStockGroup, isStockGroup, type StockGroup } from '@/lib/stock-groups';
import { NotificationService } from './notification.service';
import { deleteTaskProof, saveTaskProof } from '@/lib/task-proof-storage';
import { normalizeWhatsAppNumber } from '@/lib/phone';
import { formatStock } from '@/lib/product-units';

const PROOF_TOKEN_PATTERN = /^[a-f0-9]{64}$/i;
const hashProofToken = (token: string) => createHash('sha256').update(token).digest('hex');
/** Link foto bukti hanya untuk distribusi Peralatan Listrik (untuk sementara). */
export const usesProofLink = (stockGroup: string) => stockGroup === 'LISTRIK';

const MAX_ITEMS = 50;
const TEXT_LIMIT = 150;
// Form bisa berisi puluhan barang (beberapa query per barang), jadi batas waktu transaksi dilonggarkan.
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

export interface DistributionItemInput {
  productId: string;
  quantity: number;
  /** Lokasi pemasangan (khusus Peralatan Listrik); kosong = tujuan dokumen. */
  location?: string | null;
}

export interface CreateDistributionInput {
  stockGroup: string;
  recipientUnit: string;
  orderNumber?: string | null;
  /** Tanggal pesanan/distribusi, format YYYY-MM-DD (WIB) */
  date?: string | null;
  /** Izinkan tanggal ke depan (mis. tanggal ACC pengajuan yang dijadwalkan admin). */
  allowFutureDate?: boolean;
  storageLocation?: string | null;
  receiverName?: string | null;
  /** No. WhatsApp petugas (opsional, khusus Peralatan Listrik) */
  officerPhone?: string | null;
  handoverName: string;
  notes?: string | null;
  items: DistributionItemInput[];
  actorUserId?: string | null;
}

export interface DistributionListFilter {
  stockGroup: StockGroup;
  month: string;
  search?: string;
  status?: 'COMPLETED' | 'CANCELLED' | 'all';
  page?: number;
  pageSize?: number;
}

const itemInclude = {
  items: {
    include: { product: { select: { id: true, name: true, sku: true, unit: true, packUnit: true, packSize: true } } },
    orderBy: { id: 'asc' as const },
  },
  creator: { select: { id: true, name: true } },
  proofs: { orderBy: { uploadedAt: 'asc' as const } },
} satisfies Prisma.DistributionInclude;

export type DistributionWithItems = Prisma.DistributionGetPayload<{ include: typeof itemInclude }>;

function cleanText(value: unknown, label: string, required = false): string | null {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!text) {
    if (required) throw new Error(`${label} wajib diisi.`);
    return null;
  }
  if (text.length > TEXT_LIMIT) throw new Error(`${label} maksimal ${TEXT_LIMIT} karakter.`);
  return text;
}

/** "2026-11-17" ditafsirkan sebagai tengah hari WIB agar tidak bergeser tanggal di zona waktu lain. */
function parseDistributionDate(value: string | null | undefined, allowFuture = false): Date {
  if (!value) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Tanggal distribusi tidak valid.');
  const date = new Date(`${value}T12:00:00+07:00`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Tanggal distribusi tidak valid.');
  if (!allowFuture && date.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new Error('Tanggal distribusi tidak boleh di masa depan.');
  return date;
}

function monthKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).formatToParts(date);
  return `${parts.find((p) => p.type === 'year')!.value}${parts.find((p) => p.type === 'month')!.value}`;
}

export class DistributionService {
  /**
   * Simpan form distribusi dan kurangi stok setiap barang dalam satu transaksi.
   * Jika satu barang gagal (stok kurang, nonaktif, beda jenis), seluruh form dibatalkan.
   */
  static async create(input: CreateDistributionInput) {
    const result = await this.runTransaction((tx) => this.createInTransaction(tx, input));
    await this.notifyStockLevels(result.stockAfter, input.actorUserId);
    return { distribution: result.distribution, proofToken: result.proofToken };
  }

  static async runTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await prisma.$transaction(work, TX_OPTIONS);
      } catch (error) {
        // Ulangi seluruh transaksi jika nomor distribusi bentrok.
        const isNumberClash = error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' && Array.isArray(error.meta?.target) && error.meta.target.includes('number');
        if (isNumberClash && attempt < 3) continue;
        throw error;
      }
    }
  }

  static async notifyStockLevels(stockAfter: { productId: string; stock: number }[], actorUserId?: string | null) {
    await Promise.all(stockAfter.map(({ productId, stock }) =>
      NotificationService.checkStockLevelAndAlert(productId, stock, actorUserId).catch(() => undefined)
    ));
  }

  static async createInTransaction(tx: Prisma.TransactionClient, input: CreateDistributionInput) {
    if (!isStockGroup(input.stockGroup)) throw new Error('Jenis stok tidak dikenal.');
    const group = getStockGroup(input.stockGroup);

    const recipientUnit = cleanText(input.recipientUnit, group.recipientLabel, true)!;
    const handoverName = cleanText(input.handoverName, group.handoverLabel, true)!;
    const orderNumber = cleanText(input.orderNumber, 'No. nota pesanan');
    const storageLocation = cleanText(input.storageLocation, 'Tempat penyimpanan');
    const receiverName = cleanText(input.receiverName, 'Nama penerima');
    const officerPhone = usesProofLink(group.id) ? normalizeWhatsAppNumber(input.officerPhone) : null;
    const notes = typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim().slice(0, 500) : null;
    const distributedAt = parseDistributionDate(input.date, input.allowFutureDate);

    const rawItems = Array.isArray(input.items) ? input.items : [];
    if (rawItems.length === 0) throw new Error('Tambahkan minimal satu barang.');
    if (rawItems.length > MAX_ITEMS) throw new Error(`Maksimal ${MAX_ITEMS} barang per form.`);

    const seen = new Set<string>();
    const items = rawItems.map((item, index) => {
      const quantity = Number(item?.quantity);
      if (!item?.productId) throw new Error(`Barang pada baris ${index + 1} belum dipilih.`);
      if (!Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new Error(`Jumlah pada baris ${index + 1} harus bilangan bulat lebih dari nol.`);
      }
      const location = usesProofLink(group.id) ? cleanText(item.location, 'Lokasi pemasangan') : null;
      // Barang yang sama boleh muncul lagi hanya jika lokasinya berbeda.
      const key = `${item.productId}|${location ?? recipientUnit}`;
      if (seen.has(key)) throw new Error(`Barang pada baris ${index + 1} sudah ada di baris lain${location ? ' untuk lokasi yang sama' : ''}. Gabungkan jumlahnya.`);
      seen.add(key);
      return { productId: item.productId, quantity, location: location && location !== recipientUnit ? location : null };
    });

    const prefix = `${group.numberPrefix}-${monthKey(distributedAt)}-`;
    // Token mentah hanya dikembalikan sekali (untuk dikirim ke petugas); database menyimpan hash-nya.
    const proofToken = usesProofLink(group.id) ? randomBytes(32).toString('hex') : null;

    const products = await tx.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
      include: { category: { select: { stockGroup: true } } },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    const last = await tx.distribution.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const nextNumber = (last ? Number(last.number.slice(prefix.length)) || 0 : 0) + 1;
    const number = `${prefix}${String(nextNumber).padStart(3, '0')}`;

    const distribution = await tx.distribution.create({
      data: {
        number,
        stockGroup: group.id,
        recipientUnit,
        orderNumber,
        distributedAt,
        storageLocation,
        receiverName,
        handoverName,
        officerPhone,
        notes,
        creatorUserId: input.actorUserId || null,
        proofTokenHash: proofToken ? hashProofToken(proofToken) : null,
      },
    });

    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product) throw new Error('Salah satu barang tidak ditemukan.');
      if (!product.isActive) throw new Error(`Barang "${product.name}" nonaktif dan tidak dapat didistribusikan.`);
      if ((product.category?.stockGroup ?? 'ATK') !== group.id) {
        throw new Error(`Barang "${product.name}" bukan termasuk jenis ${group.label}.`);
      }
    }

    // Satu query untuk semua barang: stok hanya dikurangi jika cukup (aman bila dua admin
    // mengambil barang yang sama bersamaan), dan stok sesudahnya langsung dikembalikan.
    // Barang yang sama di beberapa lokasi dijumlahkan dulu; riwayat per baris dihitung berurutan di bawah.
    const totalByProduct = new Map<string, number>();
    for (const item of items) totalByProduct.set(item.productId, (totalByProduct.get(item.productId) ?? 0) + item.quantity);
    const totals = Array.from(totalByProduct, ([productId, quantity]) => ({ productId, quantity }));
    const updatedRows = await tx.$queryRaw<{ id: string; currentStock: number }[]>`
      UPDATE "Product" AS p
      SET "currentStock" = p."currentStock" - v.qty, "updatedAt" = NOW()
      FROM (VALUES ${Prisma.join(totals.map((item) => Prisma.sql`(${item.productId}::text, ${item.quantity}::int)`))}) AS v(id, qty)
      WHERE p.id = v.id AND p."currentStock" >= v.qty
      RETURNING p.id, p."currentStock"`;
    const afterById = new Map(updatedRows.map((row) => [row.id, Number(row.currentStock)]));
    const short = totals.find((item) => !afterById.has(item.productId));
    if (short) {
      const product = byId.get(short.productId)!;
      const fresh = await tx.product.findUnique({ where: { id: product.id }, select: { currentStock: true } });
      // Melempar error membatalkan seluruh transaksi, termasuk barang lain yang sudah dikurangi.
      throw new Error(
        `Stok "${product.name}" tidak cukup: diminta ${formatStock(product, short.quantity)}, tersedia ${formatStock(product, fresh?.currentStock ?? 0)}.`
      );
    }

    // ID transaksi dibuat di sini agar item distribusi bisa langsung merujuknya (createMany tidak mengembalikan ID).
    const running = new Map(afterById);
    totalByProduct.forEach((total, productId) => running.set(productId, (afterById.get(productId) ?? 0) + total));
    const lines = items.map((item) => {
      const before = running.get(item.productId)!;
      running.set(item.productId, before - item.quantity);
      return { item, product: byId.get(item.productId)!, movementId: randomUUID(), before, after: before - item.quantity };
    });
    await tx.stockMovement.createMany({
      data: lines.map(({ item, product, movementId, before, after }) => ({
        id: movementId,
        productId: product.id,
        actorUserId: input.actorUserId || null,
        type: 'OUT',
        quantity: item.quantity,
        stockBefore: before,
        stockAfter: after,
        source: 'WEB',
        referenceId: distribution.id,
        notes: `Distribusi ${number} ke ${recipientUnit}`,
      })),
    });
    await tx.distributionItem.createMany({
      data: lines.map(({ item, product, movementId }) => ({
        distributionId: distribution.id,
        productId: product.id,
        quantity: item.quantity,
        unit: product.unit,
        location: item.location,
        movementId,
      })),
    });
    const stockAfter = totals.map(({ productId }) => ({ productId, stock: afterById.get(productId)! }));

    const full = await tx.distribution.findUniqueOrThrow({ where: { id: distribution.id }, include: itemInclude });
    return { distribution: full, stockAfter, proofToken };
  }

  /** Batalkan distribusi: stok dikembalikan lewat movement REVERSAL, dokumen tetap tersimpan. */
  static async cancel(id: string, reason: string, actorUserId?: string | null) {
    const cleanReason = reason?.trim();
    if (!cleanReason) throw new Error('Alasan pembatalan wajib diisi.');

    const result = await prisma.$transaction(async (tx) => {
      const distribution = await tx.distribution.findUnique({ where: { id }, include: { items: true } });
      if (!distribution) throw new Error('Dokumen distribusi tidak ditemukan.');
      if (distribution.status === 'CANCELLED') throw new Error('Dokumen distribusi ini sudah dibatalkan.');

      const movementIds = distribution.items.map((item) => item.movementId).filter((value): value is string => Boolean(value));
      const alreadyReversed = await tx.stockMovement.count({ where: { type: 'REVERSAL', referenceId: { in: movementIds } } });
      if (alreadyReversed > 0) {
        throw new Error('Sebagian barang pada dokumen ini sudah dikoreksi lewat Riwayat Stok, sehingga dokumen tidak dapat dibatalkan otomatis.');
      }

      // Kembalikan stok semua barang dalam satu query, lalu catat transaksi pembalik sekaligus.
      // Barang yang sama di beberapa lokasi dijumlahkan dulu (satu baris per barang di UPDATE).
      const totalByProduct = new Map<string, number>();
      for (const item of distribution.items) totalByProduct.set(item.productId, (totalByProduct.get(item.productId) ?? 0) + item.quantity);
      const restored = await tx.$queryRaw<{ id: string; currentStock: number }[]>`
        UPDATE "Product" AS p
        SET "currentStock" = p."currentStock" + v.qty, "updatedAt" = NOW()
        FROM (VALUES ${Prisma.join(Array.from(totalByProduct, ([productId, quantity]) => Prisma.sql`(${productId}::text, ${quantity}::int)`))}) AS v(id, qty)
        WHERE p.id = v.id
        RETURNING p.id, p."currentStock"`;
      const afterById = new Map(restored.map((row) => [row.id, Number(row.currentStock)]));
      // Riwayat pembalik dihitung berurutan: stok awal = stok akhir dikurangi seluruh jumlah yang dikembalikan.
      const running = new Map(Array.from(totalByProduct, ([productId, total]) => [productId, (afterById.get(productId) ?? 0) - total]));
      await tx.stockMovement.createMany({
        data: distribution.items.map((item) => {
          const before = running.get(item.productId)!;
          const after = before + item.quantity;
          running.set(item.productId, after);
          return {
            productId: item.productId,
            actorUserId: actorUserId || null,
            type: 'REVERSAL',
            quantity: item.quantity,
            stockBefore: before,
            stockAfter: after,
            source: 'WEB',
            referenceId: item.movementId,
            notes: `Pembatalan distribusi ${distribution.number}. Alasan: ${cleanReason}`,
          };
        }),
      });
      const stockAfter = Array.from(totalByProduct.keys(), (productId) => ({ productId, stock: afterById.get(productId) ?? 0 }));

      await tx.distribution.update({
        where: { id },
        data: { status: 'CANCELLED', cancelReason: cleanReason.slice(0, 300), cancelledAt: new Date() },
      });
      return stockAfter;
    }, TX_OPTIONS);

    await Promise.all(
      result.map(({ productId, stock }) =>
        NotificationService.checkStockLevelAndAlert(productId, stock, actorUserId).catch(() => undefined)
      )
    );
  }

  /** Buat link foto baru (link lama tidak berlaku lagi), selama foto belum dikirim. */
  static async regenerateProofLink(id: string) {
    const distribution = await prisma.distribution.findUnique({ where: { id } });
    if (!distribution) throw new Error('Dokumen distribusi tidak ditemukan.');
    if (!usesProofLink(distribution.stockGroup)) throw new Error('Link foto hanya tersedia untuk distribusi Peralatan Listrik.');
    if (distribution.status === 'CANCELLED') throw new Error('Dokumen ini sudah dibatalkan.');
    if (distribution.proofFileName) throw new Error('Foto bukti untuk dokumen ini sudah diterima.');
    const token = randomBytes(32).toString('hex');
    await prisma.distribution.update({ where: { id }, data: { proofTokenHash: hashProofToken(token) } });
    return token;
  }

  static async getByProofToken(token: string) {
    if (!PROOF_TOKEN_PATTERN.test(token)) return null;
    return prisma.distribution.findFirst({ where: { proofTokenHash: hashProofToken(token) }, include: itemInclude });
  }

  /** Lokasi pemasangan dalam satu dokumen (item tanpa lokasi memakai tujuan dokumen), urut kemunculan. */
  static locationsOf(distribution: { recipientUnit: string; items: { location: string | null }[] }) {
    return Array.from(new Set(distribution.items.map((item) => item.location || distribution.recipientUnit)));
  }

  /**
   * Simpan foto bukti dari petugas untuk satu lokasi. Stok sudah dikurangi saat form disimpan, jadi di sini hanya foto.
   * Dokumen dianggap selesai (proofFileName terisi) saat semua lokasinya sudah punya foto.
   */
  static async attachProof(token: string, file: File, location?: string | null) {
    const distribution = await this.getByProofToken(token);
    if (!distribution) throw new Error('Link foto tidak valid atau sudah diganti.');
    if (distribution.status === 'CANCELLED') throw new Error('Distribusi ini sudah dibatalkan.');
    if (distribution.proofFileName) throw new Error('Foto bukti untuk distribusi ini sudah pernah dikirim.');

    const locations = this.locationsOf(distribution);
    const target = location?.trim() || (locations.length === 1 ? locations[0] : '');
    if (!target) throw new Error('Pilih lokasi pemasangan untuk foto ini.');
    if (!locations.includes(target)) throw new Error('Lokasi tidak dikenal pada distribusi ini.');
    if (distribution.proofs.some((proof) => proof.location === target)) {
      throw new Error(`Foto untuk lokasi "${target}" sudah pernah dikirim.`);
    }

    const fileName = await saveTaskProof(file);
    const uploadedAt = new Date();
    try {
      // Unique (distributionId, location) mencegah dua kiriman bersamaan untuk lokasi yang sama.
      await prisma.distributionProof.create({
        data: { distributionId: distribution.id, location: target, fileName, mimeType: file.type, uploadedAt },
      });
    } catch {
      await deleteTaskProof(fileName).catch(() => undefined);
      throw new Error(`Foto untuk lokasi "${target}" sudah pernah dikirim.`);
    }

    const done = await prisma.distributionProof.count({ where: { distributionId: distribution.id } });
    const completed = done >= locations.length;
    if (completed) {
      // Penanda selesai di level dokumen; sekaligus menjaga tampilan lama yang membaca proofFileName.
      await prisma.distribution.updateMany({
        where: { id: distribution.id, proofFileName: null },
        data: { proofFileName: fileName, proofMimeType: file.type, proofUploadedAt: uploadedAt },
      });
    }
    return { uploadedAt, completed, location: target, remaining: Math.max(0, locations.length - done) };
  }

  static async getById(id: string) {
    return prisma.distribution.findUnique({ where: { id }, include: itemInclude });
  }

  private static buildWhere(filter: Pick<DistributionListFilter, 'stockGroup' | 'month' | 'search' | 'status'>) {
    const range = getReportMonthRange(filter.month);
    const search = filter.search?.trim();
    const where: Prisma.DistributionWhereInput = {
      stockGroup: filter.stockGroup,
      distributedAt: range,
      ...(filter.status && filter.status !== 'all' ? { status: filter.status } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' } },
              { recipientUnit: { contains: search, mode: 'insensitive' } },
              { receiverName: { contains: search, mode: 'insensitive' } },
              { handoverName: { contains: search, mode: 'insensitive' } },
              { items: { some: { product: { name: { contains: search, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
    };
    return where;
  }

  /** Riwayat dokumen + rekap bulanan untuk satu jenis stok. */
  static async list(filter: DistributionListFilter) {
    const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 200);
    const where = this.buildWhere(filter);
    const summaryWhere = this.buildWhere({ ...filter, status: 'COMPLETED' });

    const [total, rows, summaryRows, monthRows] = await Promise.all([
      prisma.distribution.count({ where }),
      prisma.distribution.findMany({
        where,
        include: itemInclude,
        orderBy: [{ distributedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (Math.max(filter.page ?? 1, 1) - 1) * pageSize,
        take: pageSize,
      }),
      // Rekap hanya dari dokumen yang tidak dibatalkan.
      prisma.distribution.findMany({
        where: summaryWhere,
        select: {
          recipientUnit: true,
          items: { select: { quantity: true, unit: true, product: { select: { id: true, name: true, sku: true, unit: true, packUnit: true, packSize: true } } } },
        },
      }),
      // Bulan (WIB) yang memiliki dokumen, untuk pintasan pilihan bulan di halaman laporan.
      prisma.$queryRaw<{ month: string; documents: bigint }[]>`
        SELECT to_char("distributedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM') AS month,
               COUNT(*) AS documents
        FROM "Distribution"
        WHERE "stockGroup" = ${filter.stockGroup}
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 24`,
    ]);

    const byUnit = new Map<string, { unit: string; documents: number; itemLines: number }>();
    const byProduct = new Map<string, { productId: string; name: string; sku: string; unit: string; packUnit: string | null; packSize: number | null; quantity: number; documents: number }>();
    let totalLines = 0;

    for (const row of summaryRows) {
      const unitKey = row.recipientUnit.toLocaleLowerCase('id-ID');
      const unit = byUnit.get(unitKey) ?? { unit: row.recipientUnit, documents: 0, itemLines: 0 };
      unit.documents += 1;
      unit.itemLines += row.items.length;
      byUnit.set(unitKey, unit);

      for (const item of row.items) {
        totalLines += 1;
        const product = byProduct.get(item.product.id) ?? {
          productId: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          unit: item.unit,
          // Kemasan hanya berlaku bila satuan baris masih sama dengan satuan dasar barang saat ini.
          packUnit: item.product.unit === item.unit ? item.product.packUnit : null,
          packSize: item.product.unit === item.unit ? item.product.packSize : null,
          quantity: 0,
          documents: 0,
        };
        product.quantity += item.quantity;
        product.documents += 1;
        byProduct.set(item.product.id, product);
      }
    }

    return {
      items: rows,
      total,
      page: Math.max(filter.page ?? 1, 1),
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      availableMonths: monthRows.map((row) => ({ month: row.month, documents: Number(row.documents) })),
      summary: {
        documents: summaryRows.length,
        itemLines: totalLines,
        productKinds: byProduct.size,
        units: byUnit.size,
        byUnit: Array.from(byUnit.values()).sort((a, b) => b.documents - a.documents || a.unit.localeCompare(b.unit, 'id')),
        byProduct: Array.from(byProduct.values()).sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'id')),
      },
    };
  }

  /** Daftar unit/ruang tujuan yang pernah dipakai, untuk saran isian form (1 query SQL). */
  static async recentRecipients(stockGroup: StockGroup) {
    const rows = await prisma.$queryRaw<{ kind: string; value: string }[]>`
      (
        SELECT 'recipient' AS kind, "recipientUnit" AS value, MAX("createdAt") AS last_used
        FROM "Distribution"
        WHERE "stockGroup" = ${stockGroup} AND "recipientUnit" IS NOT NULL AND "recipientUnit" <> ''
        GROUP BY "recipientUnit"
        ORDER BY last_used DESC
        LIMIT 50
      )
      UNION ALL
      (
        SELECT 'handover' AS kind, "handoverName" AS value, MAX("createdAt") AS last_used
        FROM "Distribution"
        WHERE "stockGroup" = ${stockGroup} AND "handoverName" IS NOT NULL AND "handoverName" <> ''
        GROUP BY "handoverName"
        ORDER BY last_used DESC
        LIMIT 50
      )
      UNION ALL
      (
        SELECT 'receiver' AS kind, "receiverName" AS value, MAX("createdAt") AS last_used
        FROM "Distribution"
        WHERE "stockGroup" = ${stockGroup}
          AND "receiverName" IS NOT NULL
          AND "receiverName" <> ''
          AND ("notes" IS NULL OR "notes" NOT LIKE 'Contoh dari formulir kertas%')
        GROUP BY "receiverName"
        ORDER BY last_used DESC
        LIMIT 50
      )
    `;

    const recipients: string[] = [];
    const handoverNames: string[] = [];
    const receiverNames: string[] = [];
    for (const row of rows) {
      if (row.kind === 'recipient') recipients.push(row.value);
      else if (row.kind === 'handover') handoverNames.push(row.value);
      else if (row.kind === 'receiver') receiverNames.push(row.value);
    }
    return { recipients, handoverNames, receiverNames };
  }
}
