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

/** Pengguna aktif ber-sesi dengan peran ADMIN atau DIVISI, atau null. */
export async function getSessionUser() {
  const session = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    select: {
      ...SAFE_USER_SELECT,
      telegram: true,
    },
  });
  if (!user || !user.isActive || (user.role !== 'ADMIN' && user.role !== 'DIVISI')) return null;

  return user;
}

/** Hanya ADMIN: dipakai semua API admin lewat requireAdmin, jadi akun DIVISI tidak pernah lolos. */
export async function getCurrentUser() {
  const user = await getSessionUser();
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
  const user = await getCurrentUser();
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
  const user = await getSessionUser();
  if (!user || user.role !== 'DIVISI') {
    return { user: null, error: NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 }) };
  }
  return { user, error: null };
}
