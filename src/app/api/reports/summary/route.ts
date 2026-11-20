import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { requireAdmin } from '@/lib/auth-server';
import { parseStockGroup } from '@/lib/stock-groups';
import { ReportService } from '@/services/report.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const rawDays = parseInt(searchParams.get('days') || '30', 10);
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 365) : 30;
    const stockGroup = parseStockGroup(searchParams.get('jenis')) ?? undefined;
    const summary = await ReportService.getDashboardSummary(days, stockGroup);
    return NextResponse.json(summary);
  } catch (error: any) {
    return apiError(error, 'GET /api/reports/summary', req);
  }
}
