import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/auth-server';
import { ProductService } from '@/services/product.service';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const product = await ProductService.getProductById(params.id);
    if (!product) {
      return NextResponse.json({ error: 'Barang tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch (error: any) {
    return apiError(error, 'GET /api/products/[id]', req);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await req.json();
    const updated = await ProductService.updateProduct(params.id, body);
    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'PATCH /api/products/[id]', req, 'Data barang gagal diperbarui. Detail tercatat di menu Log Error.');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    // Soft toggle status as required by PRD
    const updated = await ProductService.toggleStatus(params.id);
    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'DELETE /api/products/[id]', req, 'Status barang gagal diubah. Detail tercatat di menu Log Error.');
  }
}
