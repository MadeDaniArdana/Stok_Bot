import { cache } from 'react';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

/** Field user yang aman dikirim ke klien (tanpa passwordHash). */
export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  divisionName: true,
  requestTemplateId: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Periksa sesi di PostgreSQL agar pencabutan berlaku di seluruh instance. */
export async function getSessionUser(includeTelegram = true) {
  return readSessionUser(includeTelegram);
}

// React cache hanya berlaku dalam satu render server, sehingga sesi tercabut tidak tersimpan antar-request.
const readSessionUser = cache(async (includeTelegram: boolean) => {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const record = await prisma.webSession.findUnique({
    where: { id: session.sid },
    select: {
      expiresAt: true,
      user: {
        select: {
          ...SAFE_USER_SELECT,
          sessionVersion: true,
          ...(includeTelegram ? { telegram: true } : {}),
        },
      },
    },
  });
  if (!record || record.expiresAt.getTime() <= Date.now()) return null;
  const { sessionVersion, ...user } = record.user;
  if (user.id !== session.uid || !user.isActive || user.role !== session.role || sessionVersion !== session.version) return null;
  return user;
});

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
