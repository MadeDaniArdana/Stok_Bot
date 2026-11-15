import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, role, isActive, telegramUserId, telegramUsername, unlinkTelegram } = await req.json();

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
