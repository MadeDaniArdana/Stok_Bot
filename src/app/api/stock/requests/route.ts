import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { InventoryService } from '@/services/inventory.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const requesterId = searchParams.get('requesterId') || undefined;

    const where: any = {};
    if (status && status !== 'all') where.status = status;
    if (requesterId && requesterId !== 'all') where.requesterId = requesterId;

    const requests = await prisma.stockRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        product: true,
        requester: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(requests);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { productId, requesterId, quantity, notes } = await req.json();

    if (!productId || !requesterId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Barang, pemohon, dan jumlah valid wajib diisi.' }, { status: 400 });
    }

    const request = await prisma.stockRequest.create({
      data: {
        productId,
        requesterId,
        quantity: Number(quantity),
        notes: notes?.trim() || null,
        status: 'PENDING',
      },
      include: { product: true, requester: true },
    });

    return NextResponse.json({ success: true, request }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, action, reviewerId } = await req.json(); // action: 'APPROVE', 'REJECT', 'FULFILL'

    const existing = await prisma.stockRequest.findUnique({
      where: { id },
      include: { product: true, requester: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Permintaan tidak ditemukan' }, { status: 404 });
    }

    if (action === 'REJECT') {
      const updated = await prisma.stockRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, request: updated });
    }

    if (action === 'APPROVE') {
      const updated = await prisma.stockRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, request: updated });
    }

    if (action === 'FULFILL') {
      // Potong stok nyata saat FULFILL
      const stockOutResult = await InventoryService.recordStockOut({
        productId: existing.productId,
        quantity: existing.quantity,
        actorUserId: existing.requesterId,
        source: 'WEB',
        notes: `Pemenuhan Permintaan #${existing.id.slice(0, 8)}. Keperluan: ${existing.notes || '-'}`,
        referenceId: existing.id,
      });

      const updated = await prisma.stockRequest.update({
        where: { id },
        data: {
          status: 'FULFILLED',
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          fulfilledMovementId: stockOutResult.movement.id,
        },
      });

      return NextResponse.json({ success: true, request: updated, stockOutResult });
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
