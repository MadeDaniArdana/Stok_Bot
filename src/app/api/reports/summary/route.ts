import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';
import { requireAdmin } from '@/lib/auth-server';
import { parseStockGroup } from '@/lib/stock-groups';
import { resolveSummaryPeriod } from '@/lib/report-period';
import { ReportService } from '@/services/report.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const period = resolveSummaryPeriod(searchParams.get('periode'), searchParams.get('days'));
    const stockGroup = parseStockGroup(searchParams.get('jenis')) ?? undefined;
    const summary = await ReportService.getDashboardSummary(period, stockGroup);
    return NextResponse.json(summary);
  } catch (error: any) {
    return apiError(error, 'GET /api/reports/summary', req);
  }
}
