import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/auth-server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const SOURCES = ['WEB', 'TELEGRAM', 'AI', 'UPLOAD', 'NOTIFICATION', 'BROWSER'];
const RETENTION_DAYS = 60;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const source = searchParams.get('source');
    const status = searchParams.get('status') || 'open';
    const search = searchParams.get('search')?.trim();

    // Bersihkan log lama secara otomatis.
    await prisma.errorLog.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000) } },
    });

    const where: Prisma.ErrorLogWhereInput = {
      ...(source && SOURCES.includes(source) ? { source } : {}),
      ...(status === 'open' ? { resolved: false } : status === 'resolved' ? { resolved: true } : {}),
      ...(search
        ? {
            OR: [
              { message: { contains: search, mode: 'insensitive' } },
              { location: { contains: search, mode: 'insensitive' } },
              { context: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, openBySource, total24h] = await Promise.all([
      prisma.errorLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 }),
      prisma.errorLog.groupBy({ by: ['source'], where: { resolved: false }, _count: true }),
      prisma.errorLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ]);

    return NextResponse.json({
      items,
      summary: {
        open: Object.fromEntries(openBySource.map((row) => [row.source, row._count])),
        last24h: total24h,
      },
      retentionDays: RETENTION_DAYS,
    });
  } catch (error) {
    console.error('Failed to load error logs:', error);
    return NextResponse.json({ error: 'Log error tidak dapat dimuat.' }, { status: 500 });
  }
}

/** Tandai selesai / buka lagi: { id, resolved } atau { all: true } untuk semua yang terbuka. */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await req.json().catch(() => ({}));
    if (body?.all === true) {
      const result = await prisma.errorLog.updateMany({ where: { resolved: false }, data: { resolved: true } });
      return NextResponse.json({ success: true, count: result.count });
    }
    if (typeof body?.id !== 'string') return NextResponse.json({ error: 'ID log wajib diisi.' }, { status: 400 });

    await prisma.errorLog.update({ where: { id: body.id }, data: { resolved: Boolean(body.resolved) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update error log:', error);
    return NextResponse.json({ error: 'Log error tidak dapat diperbarui.' }, { status: 500 });
  }
}

/** Hapus semua log yang sudah ditandai selesai. */
export async function DELETE() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const result = await prisma.errorLog.deleteMany({ where: { resolved: true } });
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Failed to delete error logs:', error);
    return NextResponse.json({ error: 'Log error tidak dapat dihapus.' }, { status: 500 });
  }
}
