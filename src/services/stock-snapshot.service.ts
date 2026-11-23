import { prisma } from '@/lib/prisma';
import { getCurrentReportMonth, getReportMonthRange } from '@/lib/report-period';

/** "2026-11" + n bulan. */
export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Cache sisa stok akhir bulan per barang (tabel StockMonthlySnapshot).
 *
 * Laporan bulan lama tidak perlu lagi menjumlah semua transaksi dari bulan itu sampai hari ini:
 * sisa akhir bulan dibaca dari cache, lalu stok lama = sisa akhir - selisih transaksi di dalam periode.
 *
 * Aturan agar cache tidak basi:
 * - Hanya bulan yang sudah lewat (WIB) yang disimpan; transaksi baru selalu bertanggal "sekarang".
 * - Baris dibuat otomatis saat dibutuhkan, termasuk untuk barang baru (cek per barang, bukan per bulan).
 * - Jika riwayat lama sebuah barang ditulis ulang (konversi satuan), panggil invalidateProduct().
 * - Barang dihapus -> baris ikut terhapus (ON DELETE CASCADE). Seluruh tabel aman dikosongkan kapan saja.
 *
 * Memakai SQL langsung agar tetap jalan walau Prisma Client belum digenerate ulang.
 */
export class StockSnapshotService {
  /**
   * Sisa stok di akhir `month` untuk barang yang sudah ada sebelum akhir bulan itu.
   * null untuk bulan berjalan/ke depan: belum ada transaksi setelah akhir bulan tsb, jadi pakai stok saat ini.
   */
  static async getClosingStocks(month: string): Promise<Map<string, number> | null> {
    if (month >= getCurrentReportMonth()) return null;
    const end = getReportMonthRange(month).lt;

    // Satu query: baca cache sekaligus ketahuan barang mana yang belum punya baris.
    const read = () => prisma.$queryRaw<Array<{ id: string; closingStock: number | null }>>`
      SELECT p.id, s."closingStock"
      FROM "Product" p
      LEFT JOIN "StockMonthlySnapshot" s ON s."productId" = p.id AND s.month = ${month}
      WHERE p."createdAt" < ${end}
    `;
    let rows = await read();
    const missing = rows.filter((r) => r.closingStock === null).map((r) => r.id);
    if (missing.length) {
      await this.build(month, missing);
      rows = await read();
    }
    return new Map(rows.filter((r) => r.closingStock !== null).map((r) => [r.id, Number(r.closingStock)]));
  }

  /**
   * Hitung sisa akhir setiap bulan dari `fromMonth` s/d bulan lalu untuk barang `productIds`, lalu simpan.
   * Sekali jalan: satu query selisih per barang per bulan sejak akhir `fromMonth`, dihitung mundur dari stok saat ini.
   */
  static async build(fromMonth: string, productIds: string[]) {
    const currentMonth = getCurrentReportMonth();
    const lastClosed = shiftMonth(currentMonth, -1);
    if (fromMonth > lastClosed || productIds.length === 0) return;

    // Stok saat ini & riwayat dibaca dari snapshot database yang sama agar konsisten.
    await prisma.$transaction(
      async (tx) => {
        const products = await tx.$queryRaw<Array<{ id: string; currentStock: number; createdAt: Date }>>`
          SELECT id, "currentStock", "createdAt" FROM "Product" WHERE id = ANY(${productIds}::text[])
        `;
        const deltas = await tx.$queryRaw<Array<{ productId: string; month: string; delta: number }>>`
          SELECT m."productId",
                 to_char(m."createdAt" + interval '7 hours', 'YYYY-MM') AS month,
                 COALESCE(SUM(m."stockAfter" - m."stockBefore"), 0)::int AS delta
          FROM "StockMovement" m
          WHERE m."createdAt" >= ${getReportMonthRange(fromMonth).lt} AND m."productId" = ANY(${productIds}::text[])
          GROUP BY 1, 2
        `;
        const deltaByKey = new Map(deltas.map((d) => [`${d.productId}|${d.month}`, Number(d.delta)]));

        const ids: string[] = [];
        const months: string[] = [];
        const values: number[] = [];
        for (const p of products) {
          // closing(k-1) = closing(k) - selisih bulan k, mulai dari stok saat ini (bulan berjalan).
          let closing = Number(p.currentStock);
          for (let k = currentMonth; k > fromMonth; k = shiftMonth(k, -1)) {
            closing -= deltaByKey.get(`${p.id}|${k}`) ?? 0;
            const month = shiftMonth(k, -1);
            if (new Date(p.createdAt) >= getReportMonthRange(month).lt) break; // barang belum ada di bulan ini
            ids.push(p.id);
            months.push(month);
            values.push(closing);
          }
        }
        if (ids.length === 0) return;
        await tx.$executeRaw`
          INSERT INTO "StockMonthlySnapshot" ("productId", "month", "closingStock")
          SELECT * FROM unnest(${ids}::text[], ${months}::text[], ${values}::int[])
          ON CONFLICT ("productId", "month") DO NOTHING
        `;
      },
      { isolationLevel: 'RepeatableRead', timeout: 30_000 }
    );
  }

  /** Hapus cache satu barang (dipanggil saat riwayat lamanya ditulis ulang). */
  static async invalidateProduct(productId: string, tx: { $executeRaw: typeof prisma.$executeRaw } = prisma) {
    await tx.$executeRaw`DELETE FROM "StockMonthlySnapshot" WHERE "productId" = ${productId}`;
  }

  /** Kosongkan seluruh cache (mis. setelah koreksi data manual di database). */
  static async invalidateAll() {
    await prisma.$executeRaw`DELETE FROM "StockMonthlySnapshot"`;
  }
}
