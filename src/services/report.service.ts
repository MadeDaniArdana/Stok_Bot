import { prisma } from '@/lib/prisma';
import { getStockGroup, STOCK_GROUPS, type StockGroup } from '@/lib/stock-groups';

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

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
  static async getDashboardSummary(days = 30, stockGroup?: StockGroup) {
    const safeDays = Number.isFinite(days) ? Math.min(Math.max(Math.trunc(days), 1), 365) : 30;
    const now = new Date();
    const todayStartUtc = startOfWibDayUtc(now);
    const cutoffDate = new Date(todayStartUtc.getTime() - (safeDays - 1) * 24 * 60 * 60 * 1000);

    const productGroupFilter = stockGroup ? { category: { stockGroup } } : {};
    const movementPeriodWhere = {
      createdAt: { gte: cutoffDate },
      ...(stockGroup ? { product: { category: { stockGroup } } } : {}),
    };

    // Semua query berjalan paralel; agregasi dilakukan di database bila memungkinkan.
    const [
      allActiveProducts,
      totalsByType,
      outByProduct,
      trendMovements,
      recentActivities,
      periodDistributions,
    ] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
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
          product: { select: { name: true, sku: true, unit: true } },
          actor: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.distribution.findMany({
        where: {
          status: 'COMPLETED',
          distributedAt: { gte: cutoffDate },
          ...(stockGroup ? { stockGroup } : {}),
        },
        select: {
          recipientUnit: true,
          stockGroup: true,
          _count: { select: { items: true } },
        },
      }),
    ]);

    // Ringkasan kondisi stok per jenis (selalu dihitung dari seluruh barang aktif agar kartu ringkasan tetap lengkap).
    const stockGroupMap = new Map(
      STOCK_GROUPS.map((g) => [
        g.id,
        {
          id: g.id,
          slug: g.slug,
          label: g.label,
          shortLabel: g.shortLabel,
          totalSku: 0,
          totalStock: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
        },
      ])
    );
    for (const p of allActiveProducts) {
      const groupId = getStockGroup(p.category?.stockGroup).id;
      const bucket = stockGroupMap.get(groupId);
      if (!bucket) continue;
      bucket.totalSku += 1;
      bucket.totalStock += p.currentStock;
      if (p.currentStock === 0) bucket.outOfStockCount += 1;
      else if (p.currentStock <= p.minimumStock) bucket.lowStockCount += 1;
    }

    // Produk sesuai filter jenis (atau seluruhnya jika tidak difilter).
    const activeProducts = stockGroup
      ? allActiveProducts.filter((p) => getStockGroup(p.category?.stockGroup).id === stockGroup)
      : allActiveProducts;

    // 1. KPI stok & arus
    const totalActiveSku = activeProducts.length;
    const totalAggregateStock = activeProducts.reduce((sum, p) => sum + p.currentStock, 0);
    const lowStockItems = activeProducts.filter((p) => p.currentStock > 0 && p.currentStock <= p.minimumStock);
    const outOfStockItems = activeProducts.filter((p) => p.currentStock === 0);

    const totalInQuantity = totalsByType.find((t) => t.type === 'IN')?._sum.quantity ?? 0;
    const totalOutQuantity = totalsByType.find((t) => t.type === 'OUT')?._sum.quantity ?? 0;

    // Peta pemakaian (OUT) per produk selama periode untuk usulan pengadaan & Top 10.
    const outStatsByProduct = new Map(
      outByProduct.map((row) => [row.productId, { totalOut: row._sum.quantity ?? 0, txCount: row._count._all }])
    );

    // 2. Top 10 barang paling banyak digunakan
    const topOutGroups = outByProduct.slice(0, 10);
    const productById = new Map(
      allActiveProducts.map((p) => [
        p.id,
        {
          id: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          currentStock: p.currentStock,
          stockGroup: getStockGroup(p.category?.stockGroup).shortLabel,
        },
      ])
    );
    const missingProductIds = topOutGroups
      .map((g) => g.productId)
      .filter((id) => !productById.has(id));
    if (missingProductIds.length > 0) {
      const inactiveTopProducts = await prisma.product.findMany({
        where: { id: { in: missingProductIds } },
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          currentStock: true,
          category: { select: { stockGroup: true } },
        },
      });
      for (const p of inactiveTopProducts) {
        productById.set(p.id, {
          id: p.id,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          currentStock: p.currentStock,
          stockGroup: getStockGroup(p.category?.stockGroup).shortLabel,
        });
      }
    }
    const topConsumed = topOutGroups.map((g) => {
      const found = productById.get(g.productId) ?? {
        id: g.productId,
        name: '-',
        sku: '-',
        unit: '',
        currentStock: 0,
        stockGroup: '-',
      };
      return {
        product: {
          id: found.id,
          name: found.name,
          sku: found.sku,
          unit: found.unit,
          currentStock: found.currentStock,
          stockGroup: found.stockGroup,
        },
        totalOut: g._sum.quantity ?? 0,
        txCount: g._count._all,
      };
    });

    // 3. Tren pergerakan dinamis sesuai periode (harian untuk <=31 hari, mingguan untuk >31 hari).
    const trendGranularity: 'daily' | 'weekly' = safeDays > 31 ? 'weekly' : 'daily';
    let dailyTrends: Array<{ date: string; inQty: number; outQty: number }> = [];

    if (trendGranularity === 'daily') {
      const buckets: Record<string, { date: string; inQty: number; outQty: number }> = {};
      const includeWeekday = safeDays <= 7;
      for (let i = safeDays - 1; i >= 0; i--) {
        const d = new Date(todayStartUtc.getTime() - i * 24 * 60 * 60 * 1000);
        const key = toWibDateKey(d);
        buckets[key] = { date: formatWibDayLabel(d, includeWeekday), inQty: 0, outQty: 0 };
      }
      for (const m of trendMovements) {
        const bucket = buckets[toWibDateKey(m.createdAt)];
        if (!bucket) continue;
        if (m.type === 'IN') bucket.inQty += m.quantity;
        if (m.type === 'OUT') bucket.outQty += m.quantity;
      }
      dailyTrends = Object.values(buckets);
    } else {
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const numWeeks = Math.ceil(safeDays / 7);
      const weeklyBuckets: Array<{ startMs: number; endMs: number; date: string; inQty: number; outQty: number }> = [];
      for (let w = 0; w < numWeeks; w++) {
        const startMs = cutoffDate.getTime() + w * weekMs;
        const endMs = Math.min(startMs + weekMs, todayStartUtc.getTime() + 24 * 60 * 60 * 1000);
        const labelStart = formatWibDayLabel(new Date(startMs), false);
        const labelEnd = formatWibDayLabel(new Date(endMs - 1), false);
        weeklyBuckets.push({
          startMs,
          endMs,
          date: labelStart === labelEnd ? labelStart : `${labelStart}–${labelEnd}`,
          inQty: 0,
          outQty: 0,
        });
      }
      for (const m of trendMovements) {
        const ts = m.createdAt.getTime();
        const idx = Math.floor((ts - cutoffDate.getTime()) / weekMs);
        const bucket = weeklyBuckets[idx];
        if (!bucket) continue;
        if (m.type === 'IN') bucket.inQty += m.quantity;
        if (m.type === 'OUT') bucket.outQty += m.quantity;
      }
      dailyTrends = weeklyBuckets.map(({ date, inQty, outQty }) => ({ date, inQty, outQty }));
    }

    // 4. Rekap Unit / Gedung paling aktif menerima distribusi dalam periode
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

    // 5. Sebaran stok per kategori
    const categoryStatsMap: Record<
      string,
      { name: string; stockGroup: string; itemCount: number; totalStock: number; criticalCount: number }
    > = {};
    for (const p of activeProducts) {
      const catName = p.category?.name || 'Tanpa Kategori';
      const groupLabel = getStockGroup(p.category?.stockGroup).shortLabel;
      categoryStatsMap[catName] ??= {
        name: catName,
        stockGroup: groupLabel,
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

    // 6. Daftar Usulan Pengadaan (barang habis dulu, lalu menipis, urut dari pemakaian tertinggi)
    const criticalItems = [...outOfStockItems, ...lowStockItems]
      .map((p) => {
        const groupInfo = getStockGroup(p.category?.stockGroup);
        const usedInPeriod = outStatsByProduct.get(p.id)?.totalOut ?? 0;
        const deficit = Math.max(p.minimumStock - p.currentStock, 0);
        const suggestedOrder = Math.max(deficit, usedInPeriod - p.currentStock, 1);
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category?.name || 'Umum',
          stockGroup: groupInfo.id,
          stockGroupLabel: groupInfo.shortLabel,
          currentStock: p.currentStock,
          minimumStock: p.minimumStock,
          unit: p.unit,
          isZero: p.currentStock === 0,
          usedInPeriod,
          suggestedOrder,
        };
      })
      .sort((a, b) => {
        if (a.isZero !== b.isZero) return a.isZero ? -1 : 1;
        return b.usedInPeriod - a.usedInPeriod || a.currentStock - b.currentStock || a.name.localeCompare(b.name, 'id');
      });

    // unused filter guard (keeps typecheck clean)
    void productGroupFilter;

    return {
      days: safeDays,
      stockGroup: stockGroup ?? null,
      trendGranularity,
      kpi: {
        totalActiveSku,
        totalAggregateStock,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
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
}
