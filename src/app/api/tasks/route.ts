import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/error-log';
import { getCurrentReportMonth, getReportMonthRange } from '@/lib/report-period';
import type { Prisma } from '@prisma/client';
import { personName } from '@/lib/deleted-account';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Laporan Pemasangan: satu daftar bukti pemasangan dari dua pintu masuk.
 * - TELEGRAM: tugas pemasangan dari bot (InstallationTask)
 * - WEB: Distribusi Peralatan Listrik dengan link foto (Distribution LISTRIK)
 * Data tetap di tabel masing-masing; di sini hanya digabung untuk ditampilkan.
 * Aturan bulan sama untuk keduanya: yang sudah ada foto menurut waktu unggah,
 * yang menunggu foto menurut waktu dibuat (WIB).
 */
type ReportItem = {
  id: string;
  source: 'TELEGRAM' | 'WEB';
  reference: string | null;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  quantityLabel: string;
  assigneeName: string;
  location: string;
  notes: string | null;
  status: 'PENDING' | 'COMPLETED';
  creatorName: string;
  createdAt: Date;
  completedAt: Date | null;
  photoUrl: string | null;
};

// Urutan: foto terbaru dulu, lalu yang menunggu foto menurut waktu dibuat terbaru.
function compareItems(a: ReportItem, b: ReportItem) {
  const aDone = a.completedAt?.getTime();
  const bDone = b.completedAt?.getTime();
  if (aDone !== bDone) {
    if (aDone === undefined) return 1;
    if (bDone === undefined) return -1;
    return bDone - aDone;
  }
  return b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim();
    const source = searchParams.get('source');
    const month = searchParams.get('month') ?? getCurrentReportMonth();
    let monthRange: ReturnType<typeof getReportMonthRange>;
    try {
      monthRange = getReportMonthRange(month);
    } catch {
      return NextResponse.json({ error: 'Bulan laporan tidak valid. Gunakan format YYYY-MM.' }, { status: 400 });
    }
    const requestedPage = Number(searchParams.get('page') ?? '1');
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
      return NextResponse.json({ error: 'Nomor halaman tidak valid.' }, { status: 400 });
    }
    const pageSize = 24;
    const includeTelegram = source !== 'WEB';
    const includeWeb = source !== 'TELEGRAM';
    const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });

    const taskWhere: Prisma.InstallationTaskWhereInput = {
      AND: [
        {
          OR: [
            { status: 'COMPLETED', completedAt: monthRange },
            { status: 'PENDING', createdAt: monthRange },
          ],
        },
        ...(status === 'PENDING' || status === 'COMPLETED' ? [{ status }] : []),
        ...(search ? [{
          OR: [
            { assigneeName: contains(search) },
            { location: contains(search) },
            { product: { name: contains(search) } },
          ],
        }] : []),
      ],
    };

    const distributionWhere: Prisma.DistributionWhereInput = {
      stockGroup: 'LISTRIK',
      status: 'COMPLETED', // dokumen yang dibatalkan tidak ikut
      AND: [
        {
          OR: [
            { proofFileName: { not: null }, proofUploadedAt: monthRange },
            { proofFileName: null, createdAt: monthRange },
          ],
        },
        ...(status === 'COMPLETED' ? [{ proofFileName: { not: null } }] : []),
        ...(status === 'PENDING' ? [{ proofFileName: null }] : []),
        ...(search ? [{
          OR: [
            { handoverName: contains(search) },
            { recipientUnit: contains(search) },
            { number: contains(search) },
            { items: { some: { product: { name: contains(search) } } } },
          ],
        }] : []),
      ],
    };

    // Cukup ambil tugas Telegram sebanyak yang dibutuhkan sampai halaman yang diminta;
    // distribusi listrik per bulan sedikit sehingga diambil semua lalu digabung.
    const [taskCounts, tasks, distributions] = await Promise.all([
      includeTelegram
        ? prisma.installationTask.groupBy({ by: ['status'], where: taskWhere, _count: { _all: true } })
        : Promise.resolve([] as { status: string; _count: { _all: number } }[]),
      includeTelegram
        ? prisma.installationTask.findMany({
            where: taskWhere,
            orderBy: [{ completedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' }],
            take: requestedPage * pageSize,
            include: {
              product: { select: { name: true, sku: true, unit: true } },
              creator: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      includeWeb
        ? prisma.distribution.findMany({
            where: distributionWhere,
            take: 2000,
            include: {
              items: { orderBy: { id: 'asc' }, include: { product: { select: { name: true, sku: true } } } },
              creator: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const items: ReportItem[] = [
      ...tasks.map((task): ReportItem => ({
        id: task.id,
        source: 'TELEGRAM',
        reference: null,
        productName: task.product.name,
        sku: task.product.sku,
        unit: task.product.unit,
        quantity: task.quantity,
        quantityLabel: `${task.quantity} ${task.product.unit}`,
        assigneeName: task.assigneeName,
        location: task.location,
        notes: task.notes,
        status: task.status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
        creatorName: personName(task.creator?.name, task.creatorName),
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        photoUrl: task.proofFileName ? `/api/tasks/${task.id}/photo` : null,
      })),
      ...distributions.map((distribution): ReportItem => {
        const first = distribution.items[0];
        const extra = distribution.items.length - 1;
        return {
          id: distribution.id,
          source: 'WEB',
          reference: distribution.number,
          productName: first ? `${first.product.name}${extra > 0 ? ` +${extra} lainnya` : ''}` : '-',
          sku: distribution.number,
          unit: first?.unit ?? '',
          quantity: first?.quantity ?? 0,
          quantityLabel: distribution.items.map((item) => `${item.quantity} ${item.unit}`).join(' + ') || '-',
          assigneeName: distribution.handoverName,
          location: distribution.recipientUnit,
          notes: distribution.notes,
          status: distribution.proofFileName ? 'COMPLETED' : 'PENDING',
          creatorName: personName(distribution.creator?.name, distribution.creatorName),
          createdAt: distribution.createdAt,
          completedAt: distribution.proofUploadedAt,
          photoUrl: distribution.proofFileName ? `/api/distributions/${distribution.id}/photo` : null,
        };
      }),
    ].sort(compareItems);

    const webCompleted = distributions.filter((d) => d.proofFileName).length;
    const completedCount = (taskCounts.find((group) => group.status === 'COMPLETED')?._count._all || 0) + webCompleted;
    const pendingCount = (taskCounts.find((group) => group.status === 'PENDING')?._count._all || 0) + (distributions.length - webCompleted);
    const total = completedCount + pendingCount;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    // Halaman di luar jangkauan diarahkan ke halaman terakhir; data yang sudah diambil sudah mencakupnya.
    const page = Math.min(requestedPage, totalPages);

    return NextResponse.json({
      month,
      page,
      pageSize,
      total,
      totalPages,
      completedCount,
      pendingCount,
      items: items.slice((page - 1) * pageSize, page * pageSize),
    });
  } catch (error) {
    return apiError(error, 'GET /api/tasks', req, 'Daftar tugas tidak dapat dimuat.');
  }
}
