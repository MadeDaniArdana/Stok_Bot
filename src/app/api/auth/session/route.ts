import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const users = await prisma.user.findMany({
      orderBy: { role: 'asc' },
      include: { telegram: true },
    });

    const activeUserId = req.cookies.get('stockflow_user_id')?.value;
    let currentUser = users.find((u) => u.id === activeUserId);

    if (!currentUser && users.length > 0) {
      currentUser = users.find((u) => u.role === 'ADMIN') || users[0];
    }

    return NextResponse.json({
      currentUser: currentUser || null,
      availableUsers: users,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    const response = NextResponse.json({ success: true, user });
    response.cookies.set('stockflow_user_id', user.id, {
      path: '/',
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
