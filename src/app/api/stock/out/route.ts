import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await InventoryService.recordStockOut({
      productId: body.productId,
      quantity: Number(body.quantity),
      actorUserId: body.actorUserId,
      source: body.source || 'WEB',
      notes: body.notes,
      referenceId: body.referenceId,
    });

    return NextResponse.json({
      success: true,
      message: 'Barang keluar berhasil dicatat.',
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
