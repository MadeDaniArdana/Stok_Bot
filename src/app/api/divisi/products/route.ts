import { NextResponse } from 'next/server';
import { requireDivisi } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/error-log';

export const dynamic = 'force-dynamic';

/** Daftar barang ATK/Logistik aktif beserta sisa stok untuk dipilih divisi (tanpa harga/supplier). */
export async function GET() {
  try {
    const auth = await requireDivisi();
    if (auth.error) return auth.error;
    const products = await prisma.product.findMany({
      where: { isActive: true, category: { stockGroup: { in: ['ATK', 'LOGISTIK'] } } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, unit: true, packUnit: true, packSize: true, currentStock: true, category: { select: { name: true, stockGroup: true } } },
    });
    return NextResponse.json(products.map(({ category, ...p }) => ({ ...p, categoryName: category?.name ?? '-', stockGroup: category?.stockGroup ?? 'ATK' })));
  } catch (error) {
    return apiError(error, 'GET /api/divisi/products');
  }
}
