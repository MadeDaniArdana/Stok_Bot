import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session';

export const runtime = 'nodejs';

// Rate limit login berbasis sliding-window per IP dan per email (in-memory per instance).
const WINDOW_MS = 15 * 60 * 1000; // 15 menit
const MAX_IP_FAILURES = 10;
const MAX_EMAIL_FAILURES = 5;
const MAX_BUCKETS = 2000;
const DUMMY_PASSWORD_HASH = `scrypt:${'00'.repeat(16)}:${'00'.repeat(64)}`;

type RateBucket = { count: number; resetAt: number };
const failureBuckets = new Map<string, RateBucket>();

function getClientIp(req: NextRequest): string {
  return (
    req.ip ||
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

function pruneBuckets(now: number) {
  if (failureBuckets.size < 1000) return;
  failureBuckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) failureBuckets.delete(key);
  });
  while (failureBuckets.size > MAX_BUCKETS) {
    const oldestKey = failureBuckets.keys().next().value;
    if (!oldestKey) break;
    failureBuckets.delete(oldestKey);
  }
}

function checkRateLimit(key: string, max: number, now: number): number {
  const bucket = failureBuckets.get(key);
  if (!bucket) return 0;
  if (bucket.resetAt <= now) {
    failureBuckets.delete(key);
    return 0;
  }
  return bucket.count >= max ? Math.ceil((bucket.resetAt - now) / 1000) : 0;
}

function recordFailure(key: string, now: number) {
  pruneBuckets(now);
  const bucket = failureBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    failureBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    bucket.count += 1;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = body?.email;
    const password = body?.password;
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return NextResponse.json({ error: 'Email dan kata sandi wajib diisi.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const ip = getClientIp(req);
    const ipKey = `ip:${ip}`;
    const emailKey = `email:${normalizedEmail}`;
    const now = Date.now();

    const retryAfter = Math.max(
      checkRateLimit(ipKey, MAX_IP_FAILURES, now),
      checkRateLimit(emailKey, MAX_EMAIL_FAILURES, now)
    );
    if (retryAfter > 0) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login. Silakan coba lagi beberapa menit lagi.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    // Tetap jalankan scrypt untuk mencegah enumerasi akun lewat perbedaan waktu respons.
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !user.passwordHash || !valid || !user.isActive || (user.role !== 'ADMIN' && user.role !== 'DIVISI')) {
      recordFailure(ipKey, now);
      recordFailure(emailKey, now);
      return NextResponse.json({ error: 'Email atau kata sandi salah.' }, { status: 401 });
    }

    failureBuckets.delete(emailKey);
    failureBuckets.delete(ipKey);

    const token = await createSessionToken(user.id, user.role);
    const response = NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json({ error: 'Login gagal diproses. Coba lagi.' }, { status: 500 });
  }
}
