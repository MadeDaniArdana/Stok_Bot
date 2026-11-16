import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEnvAdminIds } from '@/lib/telegram-admins';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, role, isActive, telegramUserId, telegramUsername, unlinkTelegram } = await req.json();

    // ID admin Telegram otomatis tertaut ulang oleh bot, jadi hak admin-nya harus dicabut agar putusnya permanen.
    if (unlinkTelegram) {
      const link = await prisma.telegramUser.findUnique({ where: { userId: params.id } });
      if (link) {
        if (getEnvAdminIds().includes(link.telegramUserId)) {
          return NextResponse.json(
            { error: 'ID ini admin dari TELEGRAM_ADMIN_IDS di Vercel, hapus dari sana agar tautan tidak terbentuk lagi.' },
            { status: 400 }
          );
        }
        await prisma.telegramAdmin.deleteMany({ where: { telegramUserId: link.telegramUserId } });
        await prisma.telegramConversation.deleteMany({ where: { telegramUserId: link.telegramUserId } });
      }
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        name: name ? name.trim() : undefined,
        role: role ? role : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      include: { telegram: true },
    });

    if (unlinkTelegram) {
      await prisma.telegramUser.deleteMany({
        where: { userId: params.id },
      });
    } else if (telegramUserId) {
      await prisma.telegramUser.upsert({
        where: { userId: params.id },
        update: {
          telegramUserId: String(telegramUserId).trim(),
          telegramChatId: String(telegramUserId).trim(),
          username: telegramUsername ? telegramUsername.trim() : null,
          isActive: true,
        },
        create: {
          userId: params.id,
          telegramUserId: String(telegramUserId).trim(),
          telegramChatId: String(telegramUserId).trim(),
          username: telegramUsername ? telegramUsername.trim() : null,
          isActive: true,
        },
      });
    }

    const finalUser = await prisma.user.findUnique({
      where: { id: params.id },
      include: { telegram: true },
    });

    return NextResponse.json({ success: true, user: finalUser });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
