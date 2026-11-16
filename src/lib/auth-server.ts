import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

/** Pengguna yang sedang login (dari cookie sesi), atau null. */
export async function getCurrentUser() {
  const session = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.uid },
    include: { telegram: true },
  });
  if (!user || !user.isActive || user.role !== 'ADMIN') return null;

  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
