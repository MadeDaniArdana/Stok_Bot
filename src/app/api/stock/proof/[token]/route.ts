import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendTelegramMessage } from '@/lib/telegram-client';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 400 });
    }

    const movement = await prisma.stockMovement.findUnique({
      where: { proofToken: token },
      include: {
        product: {
          select: { id: true, name: true, sku: true, unit: true },
        },
        actor: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!movement) {
      return NextResponse.json(
        { error: 'Link bukti foto tidak ditemukan atau sudah kadaluarsa.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      valid: true,
      movement: {
        id: movement.id,
        productId: movement.productId,
        productName: movement.product.name,
        productSku: movement.product.sku,
        quantity: movement.quantity,
        unit: movement.product.unit,
        actorName: movement.actor?.name || 'Pegawai',
        notes: movement.notes,
        createdAt: movement.createdAt,
        proofPhoto: movement.proofPhoto,
        proofUploadedAt: movement.proofUploadedAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const { photo } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 400 });
    }

    if (!photo || typeof photo !== 'string' || !photo.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Foto bukti fisik tidak valid. Pastikan format gambar sesuai.' },
        { status: 400 }
      );
    }

    const movement = await prisma.stockMovement.findUnique({
      where: { proofToken: token },
      include: {
        product: true,
        actor: true,
      },
    });

    if (!movement) {
      return NextResponse.json(
        { error: 'Transaksi tidak ditemukan atau token tidak valid.' },
        { status: 404 }
      );
    }

    // Update movement dengan foto bukti fisik
    const updated = await prisma.stockMovement.update({
      where: { proofToken: token },
      data: {
        proofPhoto: photo,
        proofUploadedAt: new Date(),
      },
      include: {
        product: true,
        actor: true,
      },
    });

    // Kirim notifikasi konfirmasi ke Telegram jika pegawai terhubung
    if (movement.actorUserId) {
      try {
        const tgUser = await prisma.telegramUser.findUnique({
          where: { userId: movement.actorUserId },
        });

        if (tgUser && tgUser.isActive && tgUser.telegramChatId) {
          const successMsg = `✅ *Bukti Foto Terverifikasi!*\n\n` +
            `Bukti fisik pengambilan barang *${movement.product.name}* (${movement.quantity} ${movement.product.unit}) ` +
            `telah berhasil diunggah dan tersimpan di database web StockFlow.\n\n` +
            `_Waktu Upload: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}_`;

          await sendTelegramMessage(tgUser.telegramChatId, successMsg);
        }
      } catch (tgErr) {
        console.error('Failed sending proof upload confirmation to Telegram:', tgErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Foto bukti pemakaian barang berhasil disimpan ke sistem!',
      proofUploadedAt: updated.proofUploadedAt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
