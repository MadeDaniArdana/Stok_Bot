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
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((path) => path.endsWith('/') ? pathname.startsWith(path) : pathname === path);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  if (pathname.startsWith('/api/') && unsafe && pathname !== '/api/telegram/webhook') {
    const origin = request.headers.get('origin');
    const site = request.headers.get('sec-fetch-site');
    const appOrigin = process.env.APP_URL && URL.canParse(process.env.APP_URL)
      ? new URL(process.env.APP_URL).origin : null;
    if (site === 'cross-site' || (site === 'same-site' && !origin) ||
        (origin && origin !== request.nextUrl.origin && origin !== appOrigin)) {
      return NextResponse.json({ error: 'Asal permintaan tidak diizinkan.' }, { status: 403 });
    }
  }
  if (pathname === '/api/auth/logout' || isPublic(pathname)) return NextResponse.next();

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
  if (session?.role === 'ADMIN') return NextResponse.next();

  // Akun divisi hanya boleh membuka halaman & API pengajuan miliknya (dan logout/sesi).
  if (session?.role === 'DIVISI') {
    const allowed = ['/divisi', '/api/divisi', '/api/auth', '/print/request'].some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (allowed || pathname === '/api/logs/client') return NextResponse.next();
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    return NextResponse.redirect(new URL('/divisi', request.url));
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Kecualikan hanya aset yang diketahui agar route API tetap diperiksa.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|(?:logo-uti|logo-yayasan|kop-pengajuan-atk|icon|apple-icon)\\.png$).*)'],
};
