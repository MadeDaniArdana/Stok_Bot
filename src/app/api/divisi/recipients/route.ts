import { NextResponse } from 'next/server';
import { requireDivisi } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/error-log';

export const dynamic = 'force-dynamic';

/** Pilihan "Kepada" untuk form pengajuan: nama tujuan dari paket distribusi ATK/Logistik. */
export async function GET() {
  try {
    const auth = await requireDivisi();
    if (auth.error) return auth.error;
    const templates = await prisma.distributionTemplate.findMany({
      where: { stockGroup: { in: ['ATK', 'LOGISTIK'] } },
      orderBy: { name: 'asc' },
      select: { stockGroup: true, name: true, recipientUnit: true },
    });
    return NextResponse.json(templates);
  } catch (error) {
    return apiError(error, 'GET /api/divisi/recipients');
  }
}
