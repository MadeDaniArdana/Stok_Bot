import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
    if (session) await prisma.webSession.deleteMany({ where: { id: session.sid, userId: session.uid } });
  } catch {
    return NextResponse.json({ error: 'Gagal keluar. Silakan coba lagi.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }

  const response = NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
