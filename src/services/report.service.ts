import { prisma } from '@/lib/prisma';
import { getReportMonthRange, getStockOpeningBalance, type StockReportPeriod } from '@/lib/report-period';
import { getStockGroup, STOCK_GROUPS, type StockGroup } from '@/lib/stock-groups';
import { Prisma } from '@prisma/client';
import { summarizeStockByUnit } from '@/lib/stock-position-totals';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface DailyTrendRow {
  day: string;
  type: string;
  qty: number;
}

// Mutasi distribusi memakai tanggal dokumen. Retur dan mutasi lain memakai tanggal pencatatan.
const movementDistributionJoin = Prisma.sql`
  LEFT JOIN "DistributionItem" di ON di."movementId" = m.id
  LEFT JOIN "Distribution" d ON d.id = di."distributionId"`;
const movementDate = Prisma.sql`COALESCE(d."distributedAt", m."createdAt")`;

function queryStockDeltas(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>, start: Date, end: Date,
  { stockGroup, productIds, recordedFrom }: { stockGroup?: StockGroup; productIds?: string[]; recordedFrom?: Date },
) {
  const movementScope = stockGroup ? Prisma.sql`
      JOIN "Product" p ON p.id = m."productId"
      JOIN "Category" c ON c.id = p."categoryId" AND c."stockGroup" = ${stockGroup}
    ` : Prisma.empty;
  return db.$queryRaw<Array<{
    productId: string;
    firstDate: Date;
    hasMovement: boolean;
    afterDelta: number;
    periodDelta: number;
    inQty: number;
    outQty: number;
    cancelOut: number;
    cancelIn: number;
    adjustment: number;
  }>>`
    WITH movements AS (
      SELECT m."productId", m.type, m."stockAfter" - m."stockBefore" AS delta, ${movementDate} AS date,
             (${movementDate} >= ${start} AND ${movementDate} < ${end}
              ${recordedFrom ? Prisma.sql`AND m."createdAt" >= ${recordedFrom}` : Prisma.empty}) AS in_period
      FROM "StockMovement" m
      ${movementScope}
      ${movementDistributionJoin}
      ${productIds ? Prisma.sql`WHERE m."productId" IN (${Prisma.join(productIds)})` : Prisma.empty}
    )
    SELECT "productId", MIN(date) AS "firstDate",
      BOOL_OR(in_period) AS "hasMovement",
      COALESCE(SUM(delta) FILTER (WHERE date >= ${end}), 0)::int AS "afterDelta",
      COALESCE(SUM(delta) FILTER (WHERE in_period), 0)::int AS "periodDelta",
      COALESCE(SUM(delta) FILTER (WHERE in_period AND type = 'IN'), 0)::int AS "inQty",
      COALESCE(SUM(-delta) FILTER (WHERE in_period AND type = 'OUT'), 0)::int AS "outQty",
      COALESCE(SUM(delta) FILTER (WHERE in_period AND type = 'REVERSAL' AND delta > 0), 0)::int AS "cancelOut",
      COALESCE(SUM(-delta) FILTER (WHERE in_period AND type = 'REVERSAL' AND delta < 0), 0)::int AS "cancelIn",
      COALESCE(SUM(delta) FILTER (WHERE in_period AND type NOT IN ('IN', 'OUT', 'REVERSAL')), 0)::int AS "adjustment"
    FROM movements
    GROUP BY "productId"
  `;
}

function queryOutByProduct(start: Date, end: Date, stockGroup?: StockGroup) {
  return prisma.$queryRaw<{ productId: string; totalOut: number; txCount: number }[]>`
    SELECT m."productId", SUM(m.quantity)::int AS "totalOut", COUNT(*)::int AS "txCount"
    FROM "StockMovement" m
    ${movementDistributionJoin}
    JOIN "Product" p ON p.id = m."productId"
    LEFT JOIN "Category" c ON c.id = p."categoryId"
    WHERE m.type = 'OUT' AND ${movementDate} >= ${start} AND ${movementDate} < ${end}
      ${stockGroup ? Prisma.sql`AND c."stockGroup" = ${stockGroup}` : Prisma.empty}
    GROUP BY m."productId"
    ORDER BY "totalOut" DESC, m."productId"
      `;
}

function queryDailyTrendRows(start: Date, end: Date, stockGroup?: StockGroup, countMovements = false): Promise<DailyTrendRow[]> {
  const scope = stockGroup
    ? Prisma.sql`AND EXISTS (
        SELECT 1 FROM "Product" p JOIN "Category" c ON c.id = p."categoryId"
        WHERE p.id = m."productId" AND c."stockGroup" = ${stockGroup}
      )`
    : Prisma.empty;
  return prisma.$queryRaw<DailyTrendRow[]>`
    SELECT to_char(${movementDate} + interval '7 hours', 'YYYY-MM-DD') AS day,
           m.type, ${countMovements ? Prisma.sql`COUNT(*)` : Prisma.sql`SUM(m.quantity)`}::int AS qty
    FROM "StockMovement" m
    ${movementDistributionJoin}
    WHERE ${movementDate} >= ${start} AND ${movementDate} < ${end}
      AND m.type IN ('IN', 'OUT') ${scope}
    GROUP BY 1, 2
  `;
}

function buildTrendSeries(
  rows: DailyTrendRow[],
  start: Date,
  end: Date,
  days: number,
  periodKind: 'days' | 'month' | 'year'
) {
  const trendGranularity: 'daily' | 'weekly' | 'monthly' =
    periodKind === 'year' ? 'monthly' : days > 31 ? 'weekly' : 'daily';

  let totalInQuantity = 0;
  let totalOutQuantity = 0;
  for (const r of rows) {
    const qty = Number(r.qty) || 0;
    if (r.type === 'IN') totalInQuantity += qty;
    else if (r.type === 'OUT') totalOutQuantity += qty;
  }

  let dailyTrends: Array<{ date: string; inQty: number; outQty: number }> = [];
  if (trendGranularity === 'monthly') {
    const year = Number(toWibDateKey(start).slice(0, 4));
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      date: new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, i, 15))),
      inQty: 0,
      outQty: 0,
    }));
    for (const r of rows) {
      const bucket = buckets[Number(r.day.slice(5, 7)) - 1];
      if (!bucket) continue;
      const qty = Number(r.qty) || 0;
      if (r.type === 'IN') bucket.inQty += qty;
      else if (r.type === 'OUT') bucket.outQty += qty;
    }
    dailyTrends = buckets;
  } else if (trendGranularity === 'daily') {
    const buckets: Record<string, { date: string; inQty: number; outQty: number }> = {};
    const includeWeekday = days <= 7;
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getTime() + i * DAY_MS);
      buckets[toWibDateKey(d)] = { date: formatWibDayLabel(d, includeWeekday), inQty: 0, outQty: 0 };
    }
    for (const r of rows) {
      const bucket = buckets[r.day];
      if (!bucket) continue;
      const qty = Number(r.qty) || 0;
      if (r.type === 'IN') bucket.inQty += qty;
      else if (r.type === 'OUT') bucket.outQty += qty;
    }
    dailyTrends = Object.values(buckets);
  } else {
    const weekMs = 7 * DAY_MS;
    const weeklyBuckets: Array<{ date: string; inQty: number; outQty: number }> = [];
    for (let w = 0; w < Math.ceil(days / 7); w++) {
      const startMs = start.getTime() + w * weekMs;
      const endMs = Math.min(startMs + weekMs, end.getTime());
      const labelStart = formatWibDayLabel(new Date(startMs), false);
      const labelEnd = formatWibDayLabel(new Date(endMs - 1), false);
      weeklyBuckets.push({ date: labelStart === labelEnd ? labelStart : `${labelStart}–${labelEnd}`, inQty: 0, outQty: 0 });
    }
    for (const r of rows) {
      const dayStartMs = Date.parse(`${r.day}T00:00:00+07:00`);
      const bucket = weeklyBuckets[Math.floor((dayStartMs - start.getTime()) / weekMs)];
      if (!bucket) continue;
      const qty = Number(r.qty) || 0;
      if (r.type === 'IN') bucket.inQty += qty;
      else if (r.type === 'OUT') bucket.outQty += qty;
    }
    dailyTrends = weeklyBuckets;
  }

  return { trendGranularity, dailyTrends, totalInQuantity, totalOutQuantity };
}

/** Tanggal kalender WIB (YYYY-MM-DD) untuk sebuah Date UTC. */
function toWibDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatWibDayLabel(date: Date, includeWeekday: boolean): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    ...(includeWeekday ? { weekday: 'short' as const } : {}),
    day: 'numeric',
    month: 'short',
  }).format(date);
}

function startOfWibDayUtc(date: Date): Date {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  const utcMidnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(utcMidnight - WIB_OFFSET_MS);
}

export class ReportService {
  /** Rentang "N hari terakhir" (WIB) untuk Dashboard harian. */
  static daysRange(days = 30): StockReportPeriod {
    const safeDays = Number.isFinite(days) ? Math.min(Math.max(Math.trunc(days), 1), 365) : 30;
    const todayStartUtc = startOfWibDayUtc(new Date());
    const startDate = new Date(todayStartUtc.getTime() - (safeDays - 1) * DAY_MS);
    return {
      kind: 'month',
      value: `${safeDays}d`,
      gte: startDate,
      lt: new Date(todayStartUtc.getTime() + DAY_MS),
      label: `${safeDays} Hari Terakhir`,
      openingLabel: `per ${formatWibDayLabel(startDate, false)}`,
    };
  }

  /**
   * Mode ringan khusus halaman /dashboard (hanya 3 query paralel):
   * KPI stok saat ini, grafik tren N hari (SQL GROUP BY), 5 stok kritis teratas, & 5 aktivitas terakhir.
   * Tidak menjalankan getStockPositionReport / distribusi / topConsumed yang hanya dipakai halaman /reports.
   */
  static async getDashboardLite(daysInput = 7) {
    const range = this.daysRange(daysInput);
    const start = range.gte;
    const end = range.lt;
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));

    const [activeProducts, trendRows, recentActivities] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          packUnit: true,
          packSize: true,
          currentStock: true,
          minimumStock: true,
          category: { select: { name: true, stockGroup: true } },
        },
      }),
      queryDailyTrendRows(start, end),
      prisma.stockMovement.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: {
          product: { select: { name: true, sku: true, unit: true, packUnit: true, packSize: true } },
          actor: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    let inStockSku = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    const criticalAll: Array<{
      id: string;
      sku: string;
      name: string;
      category: string;
      currentStock: number;
      minimumStock: number;
      unit: string;
      packUnit: string | null;
      packSize: number | null;
      isZero: boolean;
    }> = [];

    for (const p of activeProducts) {
      if (p.currentStock > 0) inStockSku += 1;
      if (p.currentStock <= 0) {
        outOfStockCount += 1;
        criticalAll.push({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category?.name || 'Tanpa Kategori',
          currentStock: p.currentStock,
          minimumStock: p.minimumStock,
          unit: p.unit,
          packUnit: p.packUnit,
          packSize: p.packSize,
          isZero: true,
        });
      } else if (p.currentStock <= p.minimumStock) {
        lowStockCount += 1;
        criticalAll.push({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category?.name || 'Tanpa Kategori',
          currentStock: p.currentStock,
          minimumStock: p.minimumStock,
          unit: p.unit,
          packUnit: p.packUnit,
          packSize: p.packSize,
          isZero: false,
        });
      }
    }

    const criticalItems = criticalAll
      .sort((a, b) => (a.isZero !== b.isZero ? (a.isZero ? -1 : 1) : a.currentStock - b.currentStock || a.name.localeCompare(b.name, 'id')))
      .slice(0, 5);

    const { trendGranularity, dailyTrends, totalInQuantity, totalOutQuantity } = buildTrendSeries(
      trendRows,
      start,
      end,
      days,
      'days'
    );

    return {
      days,
      period: { kind: 'days' as const, value: range.value, label: range.label, openingLabel: range.openingLabel },
      stockGroup: null,
      trendGranularity,
      kpi: {
        totalActiveSku: activeProducts.length,
        inStockSku,
        lowStockCount,
        outOfStockCount,
        totalInQuantity,
        totalOutQuantity,
        netMovement: totalInQuantity - totalOutQuantity,
      },
      criticalItems,
      recentActivities,
      dailyTrends,
    };
  }

  /**
   * Ringkasan persediaan untuk satu periode: angka (hari terakhir, bulan, atau tahun), tren, Top barang,
   * unit penerima, sebaran kategori, dan Daftar Usulan Pengadaan (Stok Sisa awal periode + Stok Masuk = Jumlah Stok).
   * `period` boleh berupa jumlah hari (Dashboard) atau periode bulan/tahun dari parseStockReportPeriod.
   */
  static async getDashboardSummary(period: number | StockReportPeriod = 30, stockGroup?: StockGroup, includePosition = false) {
    const isDays = typeof period === 'number';
    const range = isDays ? this.daysRange(period) : period;
    const start = range.gte;
    const end = range.lt;
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS));
    const periodKind: 'days' | 'month' | 'year' = isDays ? 'days' : range.kind;

    const movementPeriodWhere = {
      createdAt: { gte: start, lt: end },
      ...(stockGroup ? { product: { category: { stockGroup } } } : {}),
    };

    const [
      allActiveProducts,
      outByProduct,
      trendRows,
      recentActivities,
      periodDistributions,
      position,
    ] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          packUnit: true,
          packSize: true,
          currentStock: true,
          minimumStock: true,
          category: { select: { name: true, stockGroup: true } },
        },
      }),
      queryOutByProduct(start, end, stockGroup),
      queryDailyTrendRows(start, end, stockGroup, true),
      prisma.stockMovement.findMany({
        where: movementPeriodWhere,
        include: {
          product: { select: { name: true, sku: true, unit: true, packUnit: true, packSize: true } },
          actor: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.distribution.findMany({
        where: {
          status: 'COMPLETED',
          distributedAt: { gte: start, lt: end },
          ...(stockGroup ? { stockGroup } : {}),
        },
        select: { recipientUnit: true, stockGroup: true, _count: { select: { items: true } } },
      }),
      this.getStockPositionReport(range, stockGroup),
    ]);

    // Ringkasan kondisi stok per jenis (stok saat ini, seluruh barang aktif).
    const stockGroupMap = new Map(
      STOCK_GROUPS.map((g) => [
        g.id,
        { id: g.id, slug: g.slug, label: g.label, shortLabel: g.shortLabel, totalSku: 0, inStockSku: 0, lowStockCount: 0, outOfStockCount: 0 },
      ])
    );
    for (const p of allActiveProducts) {
      const bucket = stockGroupMap.get(getStockGroup(p.category?.stockGroup).id);
      if (!bucket) continue;
      bucket.totalSku += 1;
      if (p.currentStock > 0) bucket.inStockSku += 1;
      if (p.currentStock === 0) bucket.outOfStockCount += 1;
      else if (p.currentStock <= p.minimumStock) bucket.lowStockCount += 1;
    }

    const activeProducts = stockGroup
      ? allActiveProducts.filter((p) => getStockGroup(p.category?.stockGroup).id === stockGroup)
      : allActiveProducts;

    const { trendGranularity, dailyTrends } = buildTrendSeries(
      trendRows,
      start,
      end,
      days,
      periodKind
    );
    // Top 10 barang paling banyak digunakan
    const topOutGroups = outByProduct.slice(0, 10);
    const productById = new Map(
      allActiveProducts.map((p) => [
        p.id,
        { id: p.id, name: p.name, sku: p.sku, unit: p.unit, packUnit: p.packUnit, packSize: p.packSize, currentStock: p.currentStock, stockGroup: getStockGroup(p.category?.stockGroup).shortLabel },
      ])
    );
    const missingProductIds = topOutGroups.map((g) => g.productId).filter((id) => !productById.has(id));
    if (missingProductIds.length > 0) {
      const inactiveTopProducts = await prisma.product.findMany({
        where: { id: { in: missingProductIds } },
        select: { id: true, name: true, sku: true, unit: true, packUnit: true, packSize: true, currentStock: true, category: { select: { stockGroup: true } } },
      });
      for (const p of inactiveTopProducts) {
        productById.set(p.id, {
          id: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          packUnit: p.packUnit,
          packSize: p.packSize,
          currentStock: p.currentStock,
          stockGroup: getStockGroup(p.category?.stockGroup).shortLabel,
        });
      }
    }
    const topConsumed = topOutGroups.map((g) => ({
      product: productById.get(g.productId) ?? { id: g.productId, name: '-', sku: '-', unit: '', packUnit: null, packSize: null, currentStock: 0, stockGroup: '-' },
      totalOut: g.totalOut,
      txCount: g.txCount,
    }));

    // Unit / Gedung paling aktif menerima distribusi
    const unitMap = new Map<string, { unit: string; distributions: number; itemLines: number }>();
    for (const dist of periodDistributions) {
      const name = dist.recipientUnit.trim();
      if (!name) continue;
      const entry = unitMap.get(name) ?? { unit: name, distributions: 0, itemLines: 0 };
      entry.distributions += 1;
      entry.itemLines += dist._count.items;
      unitMap.set(name, entry);
    }
    const topUnits = Array.from(unitMap.values())
      .sort((a, b) => b.distributions - a.distributions || b.itemLines - a.itemLines || a.unit.localeCompare(b.unit, 'id'))
      .slice(0, 8);

    // Sebaran stok per kategori (stok saat ini)
    const categoryStatsMap: Record<
      string,
      { name: string; stockGroup: string; itemCount: number; inStockSku: number; criticalCount: number }
    > = {};
    for (const p of activeProducts) {
      const catName = p.category?.name || 'Tanpa Kategori';
      categoryStatsMap[catName] ??= {
        name: catName,
        stockGroup: getStockGroup(p.category?.stockGroup).shortLabel,
        itemCount: 0,
        inStockSku: 0,
        criticalCount: 0,
      };
      categoryStatsMap[catName].itemCount += 1;
      if (p.currentStock > 0) categoryStatsMap[catName].inStockSku += 1;
      if (p.currentStock <= p.minimumStock) categoryStatsMap[catName].criticalCount += 1;
    }
    const categoryStats = Object.values(categoryStatsMap).sort(
      (a, b) => b.itemCount - a.itemCount || a.name.localeCompare(b.name, 'id')
    );

    const criticalItems = this.buildProcurementItems(position, activeProducts, outByProduct);
    const outOfStockCount = criticalItems.filter((i) => i.isZero).length;

    return {
      days,
      period: { kind: periodKind, value: range.value, label: range.label, openingLabel: range.openingLabel },
      stockGroup: stockGroup ?? null,
      trendGranularity,
      ...(includePosition ? { position } : {}),
      kpi: {
        totalActiveSku: activeProducts.length,
        inStockSku: position.rows.filter((p) => p.isActive && p.closingStock > 0).length,
        incomingSku: position.rows.filter((p) => p.inQty > 0).length,
        outgoingSku: position.rows.filter((p) => p.outQty > 0).length,
        movedSku: position.rows.filter((p) => p.hasMovement).length,
        lowStockCount: criticalItems.length - outOfStockCount,
        outOfStockCount,
      },
      stockGroupStats: Array.from(stockGroupMap.values()),
      criticalItems,
      recentActivities,
      topConsumed,
      topUnits,
      dailyTrends,
      categoryStats,
    };
  }

  /** Ekspor pengadaan hanya mengambil data yang dipakai workbook. */
  static async getProcurementReport(period: number | StockReportPeriod, stockGroup?: StockGroup) {
    const isDays = typeof period === 'number';
    const range = isDays ? this.daysRange(period) : period;
    const [position, activeProducts, outByProduct] = await Promise.all([
      this.getStockPositionReport(range, stockGroup),
      prisma.product.findMany({
        where: { isActive: true, ...(stockGroup ? { category: { stockGroup } } : {}) },
        select: { id: true, minimumStock: true },
      }),
      queryOutByProduct(range.gte, range.lt, stockGroup),
    ]);
    return {
      days: Math.max(1, Math.round((range.lt.getTime() - range.gte.getTime()) / DAY_MS)),
      period: { kind: isDays ? 'days' as const : range.kind, value: range.value, label: range.label, openingLabel: range.openingLabel },
      criticalItems: this.buildProcurementItems(position, activeProducts, outByProduct),
    };
  }

  private static buildProcurementItems(
    position: Awaited<ReturnType<typeof ReportService.getStockPositionReport>>,
    activeProducts: { id: string; minimumStock: number }[],
    outByProduct: Awaited<ReturnType<typeof queryOutByProduct>>,
  ) {
    // Daftar Usulan Pengadaan: barang aktif yang sisa akhir periodenya habis / di bawah batas minimum.
    // Stok Sisa = sisa dari periode sebelumnya (awal periode), Stok Masuk = barang masuk selama periode.
    const outStatsByProduct = new Map(outByProduct.map((row) => [row.productId, row.totalOut]));
    const minimumById = new Map(activeProducts.map((p) => [p.id, p.minimumStock]));
    return position.rows
      .filter((r) => r.isActive && minimumById.has(r.id) && r.closingStock <= (minimumById.get(r.id) ?? 0))
      .map((r) => {
        const minimumStock = minimumById.get(r.id) ?? 0;
        const usedInPeriod = outStatsByProduct.get(r.id) ?? 0;
        return {
          id: r.id,
          sku: r.sku,
          name: r.name,
          category: r.category,
          stockGroup: r.stockGroup,
          stockGroupLabel: r.stockGroupLabel,
          unit: r.unit,
          packUnit: r.packUnit,
          packSize: r.packSize,
          remainingStock: r.openingStock,
          incomingStock: r.inQty,
          totalStock: r.totalAvailable,
          closingStock: r.closingStock,
          /** Stok akhir periode (sama dengan stok saat ini untuk periode berjalan). */
          currentStock: r.closingStock,
          minimumStock,
          isZero: r.closingStock <= 0,
          usedInPeriod,
          suggestedOrder: Math.max(minimumStock - r.closingStock, usedInPeriod - r.closingStock, 1),
        };
      })
      .sort((a, b) => {
        if (a.isZero !== b.isZero) return a.isZero ? -1 : 1;
        return b.usedInPeriod - a.usedInPeriod || a.currentStock - b.currentStock || a.name.localeCompare(b.name, 'id');
      });
  }

  /**
   * Posisi stok per periode (bulan/tahun) per barang:
   * Stok Awal (awal periode) + Barang Masuk (masuk) = Total Tersedia, dikurangi Keluar (± penyesuaian) = Sisa Akhir.
   * Stok awal/akhir dihitung mundur dari stok saat ini memakai selisih stockAfter - stockBefore setiap mutasi,
   * sehingga pembatalan (REVERSAL) dan penyesuaian ikut terhitung dengan benar.
   */
  static async getProductMonthPositions<T extends { id: string; currentStock: number; createdAt: Date; isActive: boolean }>(
    db: Prisma.TransactionClient, month: string, products: T[],
  ) {
    if (!products.length) return [];
    const { gte: start, lt: end } = getReportMonthRange(month);
    const deltas = await queryStockDeltas(db, start, end, {
      productIds: products.map((product) => product.id),
      recordedFrom: getStockOpeningBalance(month)?.date,
    });
    const byId = new Map(deltas.map((row) => [row.productId, row]));
    return products.map((product) => {
      const row = byId.get(product.id);
      const closingStock = product.currentStock - (row?.afterDelta ?? 0);
      const adjustment = row?.adjustment ?? 0;
      const openingStock = closingStock - (row?.periodDelta ?? 0);
      const visible = (product.createdAt < end || (row?.firstDate ?? end) < end) &&
        (product.isActive || row?.hasMovement || openingStock !== 0 || closingStock !== 0);
      return {
        ...product,
        monthPosition: visible ? {
          closingStock, adjustment,
          inQty: (row?.inQty ?? 0) - (row?.cancelIn ?? 0),
          outQty: (row?.outQty ?? 0) - (row?.cancelOut ?? 0),
        } : null,
      };
    });
  }

  static async getStockPositionReport(period: StockReportPeriod, stockGroup?: StockGroup) {
    const start = period.gte;
    const end = period.lt;
    const recordedFrom = period.kind === 'month' ? getStockOpeningBalance(period.value)?.date : undefined;

    // Rekonstruksi saldo menggunakan tanggal efektif, termasuk distribusi yang dicatat mundur.
    // Mutasi dan saldo saat ini dibaca dalam snapshot database yang sama.
    const [deltas, products] = await prisma.$transaction([
      queryStockDeltas(prisma, start, end, { stockGroup, recordedFrom }),
      prisma.product.findMany({
        where: stockGroup ? { category: { stockGroup } } : undefined,
        select: {
          id: true, sku: true, name: true, unit: true, packUnit: true, packSize: true,
          currentStock: true, isActive: true, createdAt: true, categoryId: true,
          category: { select: { name: true, stockGroup: true } },
        },
      }),
    ], { isolationLevel: 'RepeatableRead' });
    const deltaById = new Map(deltas.map((row) => [row.productId, row]));

    const rows = products
      .filter((p) => p.createdAt < end || (deltaById.get(p.id)?.firstDate ?? end) < end)
      .map((p) => {
        const d = deltaById.get(p.id);
        const closingStock = p.currentStock - (d?.afterDelta ?? 0);
        const netIncoming = Number(d?.inQty ?? 0) - Number(d?.cancelIn ?? 0);
        const netOutgoing = Number(d?.outQty ?? 0) - Number(d?.cancelOut ?? 0);
        const adjustment = Number(d?.adjustment ?? 0);
        const openingStock = closingStock - Number(d?.periodDelta ?? 0);
        const inQty = netIncoming;
        const outQty = netOutgoing;
        const group = getStockGroup(p.category?.stockGroup);
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category?.name || 'Tanpa Kategori',
          categoryId: p.categoryId,
          stockGroup: group.id,
          stockGroupLabel: group.shortLabel,
          unit: p.unit,
          packUnit: p.packUnit,
          packSize: p.packSize,
          isActive: p.isActive,
          hasMovement: d?.hasMovement ?? false,
          openingStock,
          inQty,
          totalAvailable: openingStock + inQty,
          outQty,
          adjustment,
          closingStock,
        };
      })
      // Barang nonaktif hanya tampil bila masih ada stok atau ada transaksi di periode ini.
      .filter((r) => r.isActive || r.hasMovement || r.openingStock !== 0 || r.closingStock !== 0)
      .sort(
        (a, b) =>
          a.stockGroupLabel.localeCompare(b.stockGroupLabel, 'id') ||
          a.category.localeCompare(b.category, 'id') ||
          a.name.localeCompare(b.name, 'id')
      );

    return {
      period: {
        kind: period.kind,
        value: period.value,
        label: period.label,
        openingLabel: period.openingLabel,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      stockGroup: stockGroup ?? null,
      hasAdjustment: rows.some((r) => r.adjustment !== 0),
      totalsByUnit: summarizeStockByUnit(rows),
      itemCount: rows.length,
      rows,
    };
  }
}
