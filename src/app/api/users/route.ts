import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { requireAdmin, SAFE_USER_SELECT } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        ...SAFE_USER_SELECT,
        telegram: true,
        _count: {
          select: { movements: true },
        },
      },
    });
    return NextResponse.json(users);
  } catch (error: any) {
    return apiError(error, 'GET /api/users');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { name, email, role, password, telegramUserId, telegramUsername } = await req.json();

    if (!name || !name.trim() || !email || !email.trim()) {
      return NextResponse.json({ error: 'Nama dan email wajib diisi' }, { status: 400 });
    }

    const newRole = role === 'ADMIN' ? 'ADMIN' : role === 'DIVISI' ? 'DIVISI' : 'USER';
    const hasPassword = typeof password === 'string' && password.length > 0;
    if ((newRole === 'DIVISI' && !hasPassword) || (hasPassword && password.length < 8)) {
      return NextResponse.json({ error: 'Akun divisi wajib memakai kata sandi minimal 8 karakter.' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: 'Email sudah terdaftar di sistem' }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: newRole,
        passwordHash: hasPassword ? await hashPassword(password) : undefined,
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
      select: {
        ...SAFE_USER_SELECT,
        telegram: true,
      },
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error: any) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'POST /api/users', req, 'Pengguna gagal ditambahkan. Detail tercatat di menu Log Error.');
  }
}
