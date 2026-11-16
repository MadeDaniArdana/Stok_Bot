import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        telegram: true,
        _count: {
          select: { movements: true },
        },
      },
    });
    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, role, telegramUserId, telegramUsername } = await req.json();

    if (!name || !name.trim() || !email || !email.trim()) {
      return NextResponse.json({ error: 'Nama dan email wajib diisi' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existing) {
      return NextResponse.json({ error: 'Email sudah terdaftar di sistem' }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role === 'ADMIN' ? 'ADMIN' : 'USER',
        isActive: true,
        ...(telegramUserId
          ? {
              telegram: {
                create: {
                  telegramUserId: String(telegramUserId).trim(),
                  telegramChatId: String(telegramUserId).trim(),
                  username: telegramUsername ? telegramUsername.trim() : null,
                  isActive: true,
                },
              },
            }
          : {}),
      },
      include: { telegram: true },
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
