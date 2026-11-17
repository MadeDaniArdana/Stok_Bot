import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

// Halaman/API yang boleh diakses tanpa login.
const PUBLIC_PATHS = [
  '/login',
  '/proof/', // link bukti foto untuk pemasang
  '/api/auth/login',
  '/api/tasks/proof/', // data tugas & upload foto lewat link bukti
  '/api/distributions/proof/', // data distribusi listrik & upload foto lewat link bukti
  '/api/telegram/webhook', // dilindungi TELEGRAM_WEBHOOK_SECRET
  '/api/logs/client', // laporan error browser (juga dari halaman bukti foto), dibatasi frekuensinya
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  if (session?.role === 'ADMIN') return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Semua path kecuali aset statis Next.js dan file publik.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)'],
};
