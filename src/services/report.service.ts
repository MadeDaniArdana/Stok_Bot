import { prisma } from '@/lib/prisma';

export class ReportService {
  static async getDashboardSummary(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Tren harian hanya butuh 7 hari terakhir (dan tidak melewati awal periode).
    const trendStart = new Date();
    trendStart.setDate(trendStart.getDate() - 7);
    const trendFrom = trendStart > cutoffDate ? trendStart : cutoffDate;

    const periodWhere = { createdAt: { gte: cutoffDate } };

    // Semua query berjalan paralel; agregasi dilakukan di database, bukan di memori.
    const [activeProducts, totalsByType, topOutGroups, trendMovements, recentActivities] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          sku: true,
          name: true,
          unit: true,
          currentStock: true,
          minimumStock: true,
          category: { select: { name: true } },
        },
      }),
      prisma.stockMovement.groupBy({
        by: ['type'],
        where: { ...periodWhere, type: { in: ['IN', 'OUT'] } },
        _sum: { quantity: true },
      }),
      prisma.stockMovement.groupBy({
        by: ['productId'],
        where: { ...periodWhere, type: 'OUT' },
        _sum: { quantity: true },
        _count: { _all: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      prisma.stockMovement.findMany({
        where: { createdAt: { gte: trendFrom }, type: { in: ['IN', 'OUT'] } },
        select: { type: true, quantity: true, createdAt: true },
      }),
      prisma.stockMovement.findMany({
        where: periodWhere,
        include: {
          product: { select: { name: true, sku: true, unit: true } },
          actor: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    // 1. KPI stok
    const totalActiveSku = activeProducts.length;
    const totalAggregateStock = activeProducts.reduce((sum, p) => sum + p.currentStock, 0);
    const lowStockItems = activeProducts.filter((p) => p.currentStock > 0 && p.currentStock <= p.minimumStock);
    const outOfStockItems = activeProducts.filter((p) => p.currentStock === 0);

    const totalInQuantity = totalsByType.find((t) => t.type === 'IN')?._sum.quantity ?? 0;
    const totalOutQuantity = totalsByType.find((t) => t.type === 'OUT')?._sum.quantity ?? 0;

    // 2. Barang paling banyak keluar: pakai ulang activeProducts agar tidak menambah query DB bila semuanya aktif.
    const productById = new Map(
      activeProducts.map((p) => [p.id, { id: p.id, name: p.name, sku: p.sku, unit: p.unit }])
    );
    const missingProductIds = topOutGroups
      .map((g) => g.productId)
      .filter((id) => !productById.has(id));
    if (missingProductIds.length > 0) {
      const inactiveTopProducts = await prisma.product.findMany({
        where: { id: { in: missingProductIds } },
        select: { id: true, name: true, sku: true, unit: true },
      });
      for (const p of inactiveTopProducts) productById.set(p.id, p);
    }
    const topConsumed = topOutGroups.map((g) => {
      const { id: _id, ...product } = productById.get(g.productId) ?? { id: '', name: '-', sku: '-', unit: '' };
      return { product, totalOut: g._sum.quantity ?? 0, txCount: g._count._all };
    });

    // 3. Tren pergerakan harian (7 hari terakhir)
    const trendDays: Record<string, { date: string; inQty: number; outQty: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
      trendDays[key] = { date: label, inQty: 0, outQty: 0 };
    }
    for (const m of trendMovements) {
      const day = trendDays[m.createdAt.toISOString().split('T')[0]];
      if (!day) continue;
      if (m.type === 'IN') day.inQty += m.quantity;
      if (m.type === 'OUT') day.outQty += m.quantity;
    }

    // 4. Sebaran per kategori
    const categoryStats: Record<string, { name: string; itemCount: number; totalStock: number }> = {};
    for (const p of activeProducts) {
      const catName = p.category?.name || 'Tanpa Kategori';
      categoryStats[catName] ??= { name: catName, itemCount: 0, totalStock: 0 };
      categoryStats[catName].itemCount += 1;
      categoryStats[catName].totalStock += p.currentStock;
    }

    return {
      kpi: {
        totalActiveSku,
        totalAggregateStock,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        totalInQuantity,
        totalOutQuantity,
        netMovement: totalInQuantity - totalOutQuantity,
      },
      criticalItems: [...outOfStockItems, ...lowStockItems].map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category?.name || 'Umum',
        currentStock: p.currentStock,
        minimumStock: p.minimumStock,
        unit: p.unit,
        isZero: p.currentStock === 0,
      })),
      recentActivities,
      topConsumed,
      dailyTrends: Object.values(trendDays),
      categoryStats: Object.values(categoryStats),
    };
  }
}
