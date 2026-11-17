import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/error-log';
import { getProductUnitOptions } from '@/lib/product-units';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      select: { unit: true },
      distinct: ['unit'],
      orderBy: { unit: 'asc' },
    });
    return NextResponse.json({ items: getProductUnitOptions(products.map((product) => product.unit)) });
  } catch (error) {
    return apiError(error, 'GET /api/products/units', undefined, 'Daftar satuan tidak dapat dimuat.');
  }
}
