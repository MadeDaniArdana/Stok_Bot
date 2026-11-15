import { prisma } from '@/lib/prisma';

export class ReportService {
  static async getDashboardSummary(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // 1. Master product aggregates
    const products = await prisma.product.findMany({
      include: { category: true },
    });

    const activeProducts = products.filter((p) => p.isActive);
    const totalActiveSku = activeProducts.length;
    const totalAggregateStock = activeProducts.reduce((sum, p) => sum + p.currentStock, 0);

    const lowStockItems = activeProducts.filter((p) => p.currentStock > 0 && p.currentStock <= p.minimumStock);
    const outOfStockItems = activeProducts.filter((p) => p.currentStock === 0);

    // 2. Movements in the period
    const movements = await prisma.stockMovement.findMany({
      where: {
        createdAt: { gte: cutoffDate },
      },
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        actor: { select: { name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalInQuantity = movements
      .filter((m) => m.type === 'IN')
      .reduce((sum, m) => sum + m.quantity, 0);

    const totalOutQuantity = movements
      .filter((m) => m.type === 'OUT')
      .reduce((sum, m) => sum + m.quantity, 0);

    // 3. Top Consumed Products
    const consumptionMap: Record<string, { product: any; totalOut: number; txCount: number }> = {};
    for (const m of movements) {
      if (m.type === 'OUT') {
        if (!consumptionMap[m.productId]) {
          consumptionMap[m.productId] = { product: m.product, totalOut: 0, txCount: 0 };
        }
        consumptionMap[m.productId].totalOut += m.quantity;
        consumptionMap[m.productId].txCount += 1;
      }
    }

    const topConsumed = Object.values(consumptionMap)
      .sort((a, b) => b.totalOut - a.totalOut)
      .slice(0, 5);

    // 4. Daily movement trends (last 7 days)
    const trendDays: Record<string, { date: string; inQty: number; outQty: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
      trendDays[key] = { date: label, inQty: 0, outQty: 0 };
    }

    for (const m of movements) {
      const dayKey = new Date(m.createdAt).toISOString().split('T')[0];
      if (trendDays[dayKey]) {
        if (m.type === 'IN') trendDays[dayKey].inQty += m.quantity;
        if (m.type === 'OUT') trendDays[dayKey].outQty += m.quantity;
      }
    }

    const dailyTrends = Object.values(trendDays);

    // 5. Category distribution
    const categoryStats: Record<string, { name: string; itemCount: number; totalStock: number }> = {};
    for (const p of activeProducts) {
      const catName = p.category?.name || 'Tanpa Kategori';
      if (!categoryStats[catName]) {
        categoryStats[catName] = { name: catName, itemCount: 0, totalStock: 0 };
      }
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
      recentActivities: movements.slice(0, 8),
      topConsumed,
      dailyTrends,
      categoryStats: Object.values(categoryStats),
    };
  }
}
