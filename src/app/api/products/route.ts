import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { ProductService } from '@/services/product.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const status = (searchParams.get('status') as any) || 'all';
    const stockStatus = (searchParams.get('stockStatus') as any) || 'all';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await ProductService.getProducts({
      search,
      categoryId,
      status,
      stockStatus,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return apiError(error, 'GET /api/products');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const product = await ProductService.createProduct(body);
    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
