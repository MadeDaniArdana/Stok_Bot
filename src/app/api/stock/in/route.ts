import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { InventoryService } from '@/services/inventory.service';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await req.json();
    const result = await InventoryService.recordStockIn({
      productId: body.productId,
      quantity: Number(body.quantity),
      actorUserId: auth.user.id,
      source: 'WEB',
      notes: body.notes,
      referenceId: body.referenceId,
    });

    return NextResponse.json({
      success: true,
      message: 'Barang masuk berhasil dicatat. Stok telah diperbarui.',
      data: result,
    });
  } catch (error: any) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'POST /api/stock/in', req, 'Barang masuk gagal dicatat. Detail tercatat di menu Log Error.');
  }
}
