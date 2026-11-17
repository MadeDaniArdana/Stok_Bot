import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isStockGroup } from '@/lib/stock-groups';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, description, stockGroup } = await req.json();
    if (stockGroup !== undefined && !isStockGroup(stockGroup)) {
      return NextResponse.json({ error: 'Jenis stok tidak valid.' }, { status: 400 });
    }
    const updated = await prisma.category.update({
      where: { id: params.id },
      data: {
        name: name ? name.trim() : undefined,
        description: description !== undefined ? description?.trim() || null : undefined,
        stockGroup: stockGroup ?? undefined,
      },
    });
    return NextResponse.json({ success: true, category: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const productCount = await prisma.product.count({
      where: { categoryId: params.id },
    });

    if (productCount > 0) {
      return NextResponse.json(
        { error: `Kategori tidak dapat dihapus karena masih digunakan oleh ${productCount} barang.` },
        { status: 400 }
      );
    }

    await prisma.category.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
