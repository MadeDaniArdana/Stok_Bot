import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

/** Field user yang aman dikirim ke klien (tanpa passwordHash). */
export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type SafeSessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// Cache sesi singkat (10 detik) khusus untuk pemeriksaan izin API (`includeTelegram = false`)
// agar 3–5 request paralel saat membuka 1 halaman tidak mengulang query SELECT User berkali-kali.
// Otomatis dibersihkan lewat invalidateUserSessionCache() saat profil/role/status akun diubah.
const USER_CACHE_TTL_MS = 10_000;
const USER_CACHE_MAX = 500;
const userSessionCache = new Map<string, { user: SafeSessionUser | null; expiresAt: number }>();

export function invalidateUserSessionCache(userId?: string) {
  if (userId) {
    userSessionCache.delete(userId);
    return;
  }
  userSessionCache.clear();
}

function readCachedUser(userId: string): { hit: true; user: SafeSessionUser | null } | { hit: false } {
  const entry = userSessionCache.get(userId);
  if (!entry) return { hit: false };
  if (entry.expiresAt <= Date.now()) {
    userSessionCache.delete(userId);
    return { hit: false };
  }
  return { hit: true, user: entry.user };
}

function writeCachedUser(userId: string, user: SafeSessionUser | null) {
  const now = Date.now();
  if (userSessionCache.size >= USER_CACHE_MAX) {
    userSessionCache.forEach((entry, key) => {
      if (entry.expiresAt <= now) userSessionCache.delete(key);
    });
    if (userSessionCache.size >= USER_CACHE_MAX) {
      const oldestKey = userSessionCache.keys().next().value;
      if (oldestKey) userSessionCache.delete(oldestKey);
    }
  }
  userSessionCache.set(userId, { user, expiresAt: now + USER_CACHE_TTL_MS });
}

/** Pengguna aktif ber-sesi dengan peran ADMIN atau DIVISI, atau null. */
export async function getSessionUser(includeTelegram = true) {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  if (!includeTelegram) {
    const cached = readCachedUser(session.uid);
    if (cached.hit) return cached.user;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: {
      ...SAFE_USER_SELECT,
      ...(includeTelegram ? { telegram: true } : {}),
    },
  });
  const validUser = !user || !user.isActive || (user.role !== 'ADMIN' && user.role !== 'DIVISI') ? null : user;

  if (!includeTelegram) {
    writeCachedUser(session.uid, validUser);
  }

  return validUser;
}

/** Hanya ADMIN: dipakai halaman SSR & API admin, jadi akun DIVISI tidak pernah lolos. */
export async function getCurrentUser(includeTelegram = false) {
  const user = await getSessionUser(includeTelegram);
  return user?.role === 'ADMIN' ? user : null;
}

export type CurrentAdmin = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Defense-in-depth untuk setiap API route admin (tidak bergantung pada middleware saja).
 * Mengembalikan `{ user, error: null }` bila sesi valid, atau `{ user: null, error: NextResponse(401) }`.
 */
export async function requireAdmin(): Promise<
  | { user: CurrentAdmin; error: null }
  | { user: null; error: NextResponse }
> {
  const user = await getCurrentUser(false);
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 }),
    };
  }
  return { user, error: null };
}

/** Untuk API akun divisi (pengajuan barang). */
export async function requireDivisi(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>; error: null }
  | { user: null; error: NextResponse }
> {
  const user = await getSessionUser(false);
  if (!user || user.role !== 'DIVISI') {
    return { user: null, error: NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 }) };
  }
  return { user, error: null };
}
