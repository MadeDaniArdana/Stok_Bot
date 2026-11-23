import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { InventoryService } from '@/services/inventory.service';

/** Penyesuaian stok (stok opname) per barang: body { productId, actualStock, reason }. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await req.json();
    const result = await InventoryService.recordAdjustment({
      productId: body.productId,
      actualStock: Number(body.actualStock),
      reason: String(body.reason ?? ''),
      actorUserId: auth.user.id,
    });

    return NextResponse.json({ success: true, message: 'Penyesuaian stok berhasil dicatat.', data: result });
  } catch (error: any) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'POST /api/stock/adjust', req, 'Penyesuaian stok gagal dicatat. Detail tercatat di menu Log Error.');
  }
}
