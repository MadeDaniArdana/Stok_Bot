import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { requireAdmin } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_STOCK_GROUP, isStockGroup, parseStockGroup } from '@/lib/stock-groups';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const stockGroup = parseStockGroup(new URL(req.url).searchParams.get('jenis'));
    const categories = await prisma.category.findMany({
      where: stockGroup ? { stockGroup } : undefined,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
    return NextResponse.json(categories);
  } catch (error: any) {
    return apiError(error, 'GET /api/categories', req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { name, description, stockGroup } = await req.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 });
    }

    const existing = await prisma.category.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json({ error: 'Kategori dengan nama tersebut sudah ada' }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        stockGroup: isStockGroup(stockGroup) ? stockGroup : DEFAULT_STOCK_GROUP,
      },
    });

    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (error: any) {
    return apiError(error, 'POST /api/categories', req);
  }
}
