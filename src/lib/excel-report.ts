import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Workbook } from 'exceljs';

type ReportValue = string | number | Date | null | undefined;
type ReportColumn = [label: string, width: number, dateFormat?: string];

interface ExcelReport {
  filename: string;
  sheetName: string;
  title: string;
  period: string;
  columns: ReportColumn[];
  rows: Iterable<ReportValue[]>;
  subtotals?: ReportValue[][];
}

const MAROON = 'FF800020';
const HEADER_ROW = 6;
const BODY_FONT = { name: 'Arial', size: 10 };
const SUBTOTAL_FONT = { ...BODY_FONT, bold: true };
const BODY_ALIGNMENT = { vertical: 'middle', wrapText: true } as const;
const BODY_BORDER = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } } as const;
const BODY_FILLS = ['FFFFFFFF', 'FFF8FAFC', 'FFF4DDE4'].map((argb) => ({
  type: 'pattern', pattern: 'solid', fgColor: { argb },
} as const));
let logoPromise: Promise<Buffer | null> | undefined;
const MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Excel displays the UTC clock of a Date value. Shift it so the displayed time is WIB. */
export function excelDateWib(value: Date) {
  return new Date(value.getTime() + 7 * 60 * 60 * 1000);
}

export async function excelReportResponse(report: ExcelReport) {
  const workbook = new Workbook();
  workbook.creator = 'StockFlow';
  const sheet = workbook.addWorksheet(report.sheetName, {
    views: [{ state: 'frozen', ySplit: HEADER_ROW, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:6' },
  });
  const lastColumn = report.columns.length;
  sheet.columns = report.columns.map(([, width]) => ({ width }));
  const logo = await (logoPromise ??= readFile(join(process.cwd(), 'public', 'logo-yayasan.png')).catch(() => null));
  if (logo) {
    const imageId = workbook.addImage({ base64: logo.toString('base64'), extension: 'png' });
    sheet.addImage(imageId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 42, height: 42 } });
  }
  const heading = (row: number, value: string, fontSize: number, height: number, start = 1) => {
    sheet.mergeCells(row, start, row, lastColumn);
    const cell = sheet.getCell(row, start);
    cell.value = value;
    cell.font = { name: 'Arial', size: fontSize, bold: row !== 4, color: { argb: row === 3 ? MAROON : 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sheet.getRow(row).height = height;
  };

  heading(1, 'Universitas Teknokrat Indonesia', 15, 23, logo ? 3 : 1);
  heading(2, 'Bagian Umum dan Rumah Tangga', 10, 18, logo ? 3 : 1);
  heading(3, report.title, 16, 28);
  heading(4, report.period, 11, 26);
  sheet.getRow(5).height = 6;

  const header = sheet.getRow(HEADER_ROW);
  header.values = report.columns.map(([label]) => label);
  header.height = 32;
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MAROON } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  const addRow = (values: ReportValue[], background: number, isSubtotal = false) => {
    const row = sheet.addRow(values);
    let lines = 1;
    for (const [column, [, width, dateFormat]] of report.columns.entries()) {
      const value = values[column];
      const cell = row.getCell(column + 1);
      cell.fill = BODY_FILLS[background];
      cell.font = isSubtotal ? SUBTOTAL_FONT : BODY_FONT;
      cell.alignment = BODY_ALIGNMENT;
      cell.border = BODY_BORDER;
      if (value instanceof Date) cell.numFmt = dateFormat ?? 'dd/mm/yyyy';
      if (typeof value === 'number') cell.numFmt = Number.isInteger(value) ? '#,##0' : '#,##0.##';
      if (typeof value === 'string') {
        const wrapped = value.split(/\r?\n/).reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / (width - 3))), 0);
        lines = Math.max(lines, wrapped);
      }
    }
    row.height = Math.min(180, Math.max(20, lines * 13 + 6));
  };

  let dataRows = 0;
  for (const values of report.rows) addRow(values, dataRows++ % 2);
  if (dataRows) {
    sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW + dataRows, column: lastColumn } };
    for (const values of report.subtotals ?? []) addRow(values, 2, true);
  } else {
    heading(HEADER_ROW + 1, 'Tidak ada data pada periode atau filter ini.', 10, 24);
  }

  const data = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': MIME_TYPE,
      'Content-Disposition': `attachment; filename="${report.filename}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
