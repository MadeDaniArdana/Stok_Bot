import { prisma } from '@/lib/prisma';
import type { StockReportPeriod } from '@/lib/report-period';
import { getStockGroup, STOCK_GROUPS, type StockGroup } from '@/lib/stock-groups';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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
   * Ringkasan persediaan untuk satu periode: angka (hari terakhir, bulan, atau tahun), tren, Top barang,
   * unit penerima, sebaran kategori, dan Daftar Usulan Pengadaan (Stok Sisa awal periode + Stok Masuk = Jumlah Stok).
   * `period` boleh berupa jumlah hari (Dashboard) atau periode bulan/tahun dari parseStockReportPeriod.
   */
  static async getDashboardSummary(period: number | StockReportPeriod = 30, stockGroup?: StockGroup) {
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
      totalsByType,
      outByProduct,
      trendMovements,
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
      prisma.stockMovement.groupBy({
        by: ['type'],
        where: { ...movementPeriodWhere, type: { in: ['IN', 'OUT'] } },
        _sum: { quantity: true },
      }),
      prisma.stockMovement.groupBy({
        by: ['productId'],
        where: { ...movementPeriodWhere, type: 'OUT' },
        _sum: { quantity: true },
        _count: { _all: true },
        orderBy: { _sum: { quantity: 'desc' } },
      }),
      prisma.stockMovement.findMany({
        where: { ...movementPeriodWhere, type: { in: ['IN', 'OUT'] } },
        select: { type: true, quantity: true, createdAt: true },
      }),
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
        { id: g.id, slug: g.slug, label: g.label, shortLabel: g.shortLabel, totalSku: 0, totalStock: 0, lowStockCount: 0, outOfStockCount: 0 },
      ])
    );
    for (const p of allActiveProducts) {
      const bucket = stockGroupMap.get(getStockGroup(p.category?.stockGroup).id);
      if (!bucket) continue;
      bucket.totalSku += 1;
      bucket.totalStock += p.currentStock;
      if (p.currentStock === 0) bucket.outOfStockCount += 1;
      else if (p.currentStock <= p.minimumStock) bucket.lowStockCount += 1;
    }

    const activeProducts = stockGroup
      ? allActiveProducts.filter((p) => getStockGroup(p.category?.stockGroup).id === stockGroup)
      : allActiveProducts;

    const totalInQuantity = totalsByType.find((t) => t.type === 'IN')?._sum.quantity ?? 0;
    const totalOutQuantity = totalsByType.find((t) => t.type === 'OUT')?._sum.quantity ?? 0;
    const outStatsByProduct = new Map(
      outByProduct.map((row) => [row.productId, { totalOut: row._sum.quantity ?? 0, txCount: row._count._all }])
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
      totalOut: g._sum.quantity ?? 0,
      txCount: g._count._all,
    }));

    // Tren: per bulan untuk laporan tahunan, per hari untuk <= 31 hari, per minggu untuk rentang hari yang panjang.
    const trendGranularity: 'daily' | 'weekly' | 'monthly' =
      periodKind === 'year' ? 'monthly' : days > 31 ? 'weekly' : 'daily';
    let dailyTrends: Array<{ date: string; inQty: number; outQty: number }> = [];
    if (trendGranularity === 'monthly') {
      const year = Number(toWibDateKey(start).slice(0, 4));
      const buckets = Array.from({ length: 12 }, (_, i) => ({
        date: new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(year, i, 15))),
        inQty: 0,
        outQty: 0,
      }));
      for (const m of trendMovements) {
        const bucket = buckets[Number(toWibDateKey(m.createdAt).slice(5, 7)) - 1];
        if (!bucket) continue;
        if (m.type === 'IN') bucket.inQty += m.quantity;
        if (m.type === 'OUT') bucket.outQty += m.quantity;
      }
      dailyTrends = buckets;
    } else if (trendGranularity === 'daily') {
      const buckets: Record<string, { date: string; inQty: number; outQty: number }> = {};
      const includeWeekday = days <= 7;
      for (let i = 0; i < days; i++) {
        const d = new Date(start.getTime() + i * DAY_MS);
        buckets[toWibDateKey(d)] = { date: formatWibDayLabel(d, includeWeekday), inQty: 0, outQty: 0 };
      }
      for (const m of trendMovements) {
        const bucket = buckets[toWibDateKey(m.createdAt)];
        if (!bucket) continue;
        if (m.type === 'IN') bucket.inQty += m.quantity;
        if (m.type === 'OUT') bucket.outQty += m.quantity;
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
      for (const m of trendMovements) {
        const bucket = weeklyBuckets[Math.floor((m.createdAt.getTime() - start.getTime()) / weekMs)];
        if (!bucket) continue;
        if (m.type === 'IN') bucket.inQty += m.quantity;
        if (m.type === 'OUT') bucket.outQty += m.quantity;
      }
      dailyTrends = weeklyBuckets;
    }

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
      { name: string; stockGroup: string; itemCount: number; totalStock: number; criticalCount: number }
    > = {};
    for (const p of activeProducts) {
      const catName = p.category?.name || 'Tanpa Kategori';
      categoryStatsMap[catName] ??= {
        name: catName,
        stockGroup: getStockGroup(p.category?.stockGroup).shortLabel,
        itemCount: 0,
        totalStock: 0,
        criticalCount: 0,
      };
      categoryStatsMap[catName].itemCount += 1;
      categoryStatsMap[catName].totalStock += p.currentStock;
      if (p.currentStock <= p.minimumStock) categoryStatsMap[catName].criticalCount += 1;
    }
    const categoryStats = Object.values(categoryStatsMap).sort(
      (a, b) => b.totalStock - a.totalStock || a.name.localeCompare(b.name, 'id')
    );

    // Daftar Usulan Pengadaan: barang aktif yang sisa akhir periodenya habis / di bawah batas minimum.
    // Stok Sisa = sisa dari periode sebelumnya (awal periode), Stok Masuk = barang masuk selama periode.
    const minimumById = new Map(activeProducts.map((p) => [p.id, p.minimumStock]));
    const criticalItems = position.rows
      .filter((r) => r.isActive && minimumById.has(r.id) && r.closingStock <= (minimumById.get(r.id) ?? 0))
      .map((r) => {
        const minimumStock = minimumById.get(r.id) ?? 0;
        const usedInPeriod = outStatsByProduct.get(r.id)?.totalOut ?? 0;
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
    const outOfStockCount = criticalItems.filter((i) => i.isZero).length;

    return {
      days,
      period: { kind: periodKind, value: range.value, label: range.label, openingLabel: range.openingLabel },
      stockGroup: stockGroup ?? null,
      trendGranularity,
      kpi: {
        totalActiveSku: activeProducts.length,
        totalAggregateStock: activeProducts.reduce((sum, p) => sum + p.currentStock, 0),
        lowStockCount: criticalItems.length - outOfStockCount,
        outOfStockCount,
        totalInQuantity,
        totalOutQuantity,
        netMovement: totalInQuantity - totalOutQuantity,
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

  /**
   * Posisi stok per periode (bulan/tahun) per barang:
   * Stok Lama (awal periode) + Stok Baru (masuk) = Total Tersedia, dikurangi Keluar (± penyesuaian) = Sisa Akhir.
   * Stok awal/akhir dihitung mundur dari stok saat ini memakai selisih stockAfter - stockBefore setiap mutasi,
   * sehingga pembatalan (REVERSAL) dan penyesuaian ikut terhitung dengan benar.
   */
  static async getStockPositionReport(period: StockReportPeriod, stockGroup?: StockGroup) {
    const start = period.gte;
    const end = period.lt;

    const deltas = await prisma.$queryRaw<
      Array<{
        productId: string;
        deltaSinceStart: number;
        deltaAfterEnd: number;
        inQty: number;
        outQty: number;
        cancelOut: number;
        cancelIn: number;
        adjustment: number;
      }>
    >`
      SELECT
        m."productId" AS "productId",
        COALESCE(SUM(m."stockAfter" - m."stockBefore"), 0)::int AS "deltaSinceStart",
        COALESCE(SUM(CASE WHEN m."createdAt" >= ${end} THEN m."stockAfter" - m."stockBefore" ELSE 0 END), 0)::int AS "deltaAfterEnd",
        COALESCE(SUM(CASE WHEN m."createdAt" < ${end} AND m.type = 'IN' THEN m."stockAfter" - m."stockBefore" ELSE 0 END), 0)::int AS "inQty",
        COALESCE(SUM(CASE WHEN m."createdAt" < ${end} AND m.type = 'OUT' THEN m."stockBefore" - m."stockAfter" ELSE 0 END), 0)::int AS "outQty",
        COALESCE(SUM(CASE WHEN m."createdAt" < ${end} AND m.type = 'REVERSAL' AND m."stockAfter" > m."stockBefore" THEN m."stockAfter" - m."stockBefore" ELSE 0 END), 0)::int AS "cancelOut",
        COALESCE(SUM(CASE WHEN m."createdAt" < ${end} AND m.type = 'REVERSAL' AND m."stockAfter" < m."stockBefore" THEN m."stockBefore" - m."stockAfter" ELSE 0 END), 0)::int AS "cancelIn",
        COALESCE(SUM(CASE WHEN m."createdAt" < ${end} AND m.type NOT IN ('IN', 'OUT', 'REVERSAL') THEN m."stockAfter" - m."stockBefore" ELSE 0 END), 0)::int AS "adjustment"
      FROM "StockMovement" m
      WHERE m."createdAt" >= ${start}
      GROUP BY m."productId"
    `;
    const deltaById = new Map(deltas.map((row) => [row.productId, row]));

    const products = await prisma.product.findMany({
      where: {
        createdAt: { lt: end },
        OR: [{ isActive: true }, { id: { in: Array.from(deltaById.keys()) } }],
        ...(stockGroup ? { category: { stockGroup } } : {}),
      },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        packUnit: true,
        packSize: true,
        currentStock: true,
        isActive: true,
        category: { select: { name: true, stockGroup: true } },
      },
    });

    const rows = products
      .map((p) => {
        const d = deltaById.get(p.id);
        const openingStock = p.currentStock - Number(d?.deltaSinceStart ?? 0);
        const closingStock = p.currentStock - Number(d?.deltaAfterEnd ?? 0);
        const inQty = Number(d?.inQty ?? 0) - Number(d?.cancelIn ?? 0);
        const outQty = Number(d?.outQty ?? 0) - Number(d?.cancelOut ?? 0);
        const adjustment = Number(d?.adjustment ?? 0);
        const group = getStockGroup(p.category?.stockGroup);
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category?.name || 'Tanpa Kategori',
          stockGroup: group.id,
          stockGroupLabel: group.shortLabel,
          unit: p.unit,
          packUnit: p.packUnit,
          packSize: p.packSize,
          isActive: p.isActive,
          openingStock,
          inQty,
          totalAvailable: openingStock + inQty,
          outQty,
          adjustment,
          closingStock,
        };
      })
      .sort(
        (a, b) =>
          a.stockGroupLabel.localeCompare(b.stockGroupLabel, 'id') ||
          a.category.localeCompare(b.category, 'id') ||
          a.name.localeCompare(b.name, 'id')
      );

    const totals = rows.reduce(
      (acc, r) => {
        acc.openingStock += r.openingStock;
        acc.inQty += r.inQty;
        acc.totalAvailable += r.totalAvailable;
        acc.outQty += r.outQty;
        acc.adjustment += r.adjustment;
        acc.closingStock += r.closingStock;
        if (r.inQty > 0) acc.itemsWithIn += 1;
        if (r.outQty > 0) acc.itemsWithOut += 1;
        return acc;
      },
      { openingStock: 0, inQty: 0, totalAvailable: 0, outQty: 0, adjustment: 0, closingStock: 0, itemsWithIn: 0, itemsWithOut: 0 }
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
      totals: { ...totals, itemCount: rows.length },
      rows,
    };
  }
}
