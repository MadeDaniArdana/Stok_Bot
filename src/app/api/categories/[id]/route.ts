import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { requireAdmin } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { isStockGroup } from '@/lib/stock-groups';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { id } = await params;

    const { name, description, stockGroup } = await req.json();
    if (stockGroup !== undefined && !isStockGroup(stockGroup)) {
      return NextResponse.json({ error: 'Jenis stok tidak valid.' }, { status: 400 });
    }
    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: name ? name.trim() : undefined,
        description: description !== undefined ? description?.trim() || null : undefined,
        stockGroup: stockGroup ?? undefined,
      },
    });
    return NextResponse.json({ success: true, category: updated });
  } catch (error: any) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'PATCH /api/categories/[id]', req, 'Kategori gagal diperbarui. Detail tercatat di menu Log Error.');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { id } = await params;

    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      return NextResponse.json(
        { error: `Kategori tidak dapat dihapus karena masih digunakan oleh ${productCount} barang.` },
        { status: 400 }
      );
    }

    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'DELETE /api/categories/[id]', req, 'Kategori gagal dihapus. Detail tercatat di menu Log Error.');
  }
}
