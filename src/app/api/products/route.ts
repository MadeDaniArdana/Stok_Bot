import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/auth-server';
import { ProductService } from '@/services/product.service';
import { prisma } from '@/lib/prisma';
import { getReportMonthRange, getStockOpeningBalance } from '@/lib/report-period';
import { ReportService } from '@/services/report.service';
import { parseStockGroup } from '@/lib/stock-groups';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const stockGroup = parseStockGroup(searchParams.get('jenis')) ?? undefined;
    const status = (searchParams.get('status') as any) || 'all';
    const stockStatus = (searchParams.get('stockStatus') as any) || 'all';
    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50;

    const filters = { search, categoryId, stockGroup, status, stockStatus, page, limit };
    const month = searchParams.get('stockMonth');
    if (!month) return NextResponse.json(await ProductService.getProducts(filters));
    try {
      getReportMonthRange(month);
    } catch {
      return NextResponse.json({ error: 'Bulan stok harus dalam format YYYY-MM.' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const products = await ProductService.getProducts(filters, tx);
      const items = await ReportService.getProductMonthPositions(tx, month, products.items);
      return { ...products, items, openingBalanceLabel: getStockOpeningBalance(month)?.label ?? null };
    }, { isolationLevel: 'RepeatableRead' });

    return NextResponse.json(result);
  } catch (error: any) {
    return apiError(error, 'GET /api/products', req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await req.json();
    const product = await ProductService.createProduct({ ...body, actorUserId: auth.user.id });
    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: any) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'POST /api/products', req, 'Barang gagal ditambahkan. Detail tercatat di menu Log Error.');
  }
}
