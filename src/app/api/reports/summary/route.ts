import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/error-log';

export const dynamic = 'force-dynamic';
import { ReportService } from '@/services/report.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const summary = await ReportService.getDashboardSummary(days);
    return NextResponse.json(summary);
  } catch (error: any) {
    return apiError(error, 'GET /api/reports/summary');
  }
}
