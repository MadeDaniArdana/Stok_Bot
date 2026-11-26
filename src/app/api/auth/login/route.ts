import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/session';

export const runtime = 'nodejs';

// Batas percobaan per IP dan email dibagi oleh seluruh instance aplikasi.
// Batas IP diset 30 agar beberapa staf di satu jaringan Wi-Fi kampus (NAT bersama) tidak saling mengunci,
// sementara batas per-email tetap ketat (5 percobaan).
const WINDOW_MS = 15 * 60 * 1000; // 15 menit
const MAX_IP_ATTEMPTS = 30;
const MAX_EMAIL_ATTEMPTS = 5;
const DUMMY_PASSWORD_HASH = `scrypt:${'00'.repeat(16)}:${'00'.repeat(64)}`;

class LoginRateLimit extends Error {
  constructor(readonly retryAfter: number) {
    super('Batas percobaan login tercapai.');
  }
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

async function reserveLoginAttempt(ip: string, email: string) {
  const buckets = [
    { key: `email:${email}`, limit: MAX_EMAIL_ATTEMPTS },
    { key: `ip:${ip}`, limit: MAX_IP_ATTEMPTS },
  ];

  await prisma.$transaction(async (tx) => {
    for (const bucket of buckets) {
      const key = createHash('sha256').update(bucket.key).digest('hex');
      const now = new Date();
      const expiresAt = new Date(now.getTime() + WINDOW_MS);
      const [result] = await tx.$queryRaw<{ count: number; expiresAt: Date }[]>`
        INSERT INTO "LoginAttemptBucket" ("key", "count", "expiresAt")
        VALUES (${key}, 1, ${expiresAt})
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "LoginAttemptBucket"."expiresAt" <= ${now}
            THEN 1 ELSE "LoginAttemptBucket"."count" + 1 END,
          "expiresAt" = CASE WHEN "LoginAttemptBucket"."expiresAt" <= ${now}
            THEN ${expiresAt} ELSE "LoginAttemptBucket"."expiresAt" END
        RETURNING "count", "expiresAt"
      `;
      if (result.count > bucket.limit) {
        throw new LoginRateLimit(Math.max(1, Math.ceil((result.expiresAt.getTime() - now.getTime()) / 1000)));
      }
    }
  });
}

async function pruneExpiredAttempts() {
  await prisma.$executeRaw`
    DELETE FROM "LoginAttemptBucket" WHERE "key" IN (
      SELECT "key" FROM "LoginAttemptBucket"
      WHERE "expiresAt" <= ${new Date()}
      ORDER BY "expiresAt"
      LIMIT 500
      FOR UPDATE SKIP LOCKED
    )
  `;
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
    if (Math.random() < 0.01) {
      await pruneExpiredAttempts().catch(() => console.warn('Pembersihan percobaan login tertunda.'));
    }
    await reserveLoginAttempt(getClientIp(req), normalizedEmail);

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    // Tetap jalankan scrypt untuk mencegah enumerasi akun lewat perbedaan waktu respons.
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !user.passwordHash || !valid || !user.isActive || (user.role !== 'ADMIN' && user.role !== 'DIVISI')) {
      return NextResponse.json({ error: 'Email atau kata sandi salah.' }, { status: 401 });
    }

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
    if (error instanceof LoginRateLimit) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login. Silakan coba lagi beberapa menit lagi.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfter) } }
      );
    }
    console.error('Login failed:', error);
    return NextResponse.json({ error: 'Login gagal diproses. Coba lagi.' }, { status: 500 });
  }
}
