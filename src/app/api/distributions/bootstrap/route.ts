import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { prisma } from '@/lib/prisma';
import { parseStockGroup } from '@/lib/stock-groups';
import { DistributionService } from '@/services/distribution.service';
import { DistributionTemplateService } from '@/services/distribution-template.service';

export const dynamic = 'force-dynamic';

/**
 * Data awal Form Distribusi dalam 1 request paralel (barang aktif, daftar paket, dan saran tujuan/petugas)
 * untuk menghindari 3 panggilan API terpisah setiap berpindah antar jenis distribusi.
 */
export async function GET(req: NextRequest) {
  try {
    const stockGroup = parseStockGroup(new URL(req.url).searchParams.get('jenis'));
    if (!stockGroup) return NextResponse.json({ error: 'Jenis stok tidak valid.' }, { status: 400 });

    const [products, templates, recent] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true, category: { stockGroup } },
        select: {
          id: true,
          name: true,
          sku: true,
          currentStock: true,
          unit: true,
          packUnit: true,
          packSize: true,
        },
        orderBy: { name: 'asc' },
        take: 500,
      }),
      stockGroup === 'LISTRIK' ? Promise.resolve([]) : DistributionTemplateService.list(stockGroup),
      DistributionService.recentRecipients(stockGroup),
    ]);

    return NextResponse.json({
      products,
      templates,
      recipients: recent.recipients,
      handoverNames: recent.handoverNames,
      receiverNames: recent.receiverNames,
    });
  } catch (error) {
    return apiError(error, 'GET /api/distributions/bootstrap', req, 'Terjadi kesalahan pada server. Detail tercatat di menu Log Error.');
  }
}

