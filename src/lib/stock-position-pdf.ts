import { addPdfLetterhead } from '@/lib/pdf-letterhead';
import { formatStock } from '@/lib/product-units';
import { summarizeStockByUnit } from '@/lib/stock-position-totals';

export interface StockPositionPdfRow {
  sku: string;
  name: string;
  category: string;
  stockGroupLabel: string;
  unit: string;
  packUnit: string | null;
  packSize: number | null;
  openingStock: number;
  inQty: number;
  totalAvailable: number;
  outQty: number;
  adjustment: number;
  closingStock: number;
}

export interface StockPositionPdfReport {
  period: { kind: 'month' | 'year'; value: string; label: string; openingLabel: string };
  hasAdjustment: boolean;
  rows: StockPositionPdfRow[];
}

function qty(row: StockPositionPdfRow, value: number) {
  return value < 0 ? `-${formatStock(row, -value)}` : formatStock(row, value);
}

/** Buat & unduh PDF A4 Riwayat Stok (Stok Awal, Barang Masuk, Total, Keluar, Sisa Akhir) di browser. */
export async function downloadStockPositionPdf(
  report: StockPositionPdfReport,
  /** scopeLabel: judul cakupan di kop, mis. "Jenis Stok" (bawaan) atau "Kategori". */
  options: { groupLabel: string; groupSlug: string; rows?: StockPositionPdfRow[]; scopeLabel?: string }
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;
  const rows = options.rows ?? report.rows;
  const showAdj = options.rows ? rows.some((r) => r.adjustment !== 0) : report.hasAdjustment;

  // Kop
  await addPdfLetterhead(doc, marginX, 26);

  const today = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`LAPORAN RIWAYAT STOK ${report.period.kind === 'year' ? 'TAHUNAN' : 'BULANAN'}`, pageWidth / 2, 34, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `${options.scopeLabel ?? 'Jenis Stok'}: ${options.groupLabel}  ·  Periode: ${report.period.label}  ·  Dicetak: ${today}`,
    pageWidth / 2,
    39,
    { align: 'center' }
  );

  const head = [
    [
      'No',
      'Nama Barang',
      'Jenis',
      `Stok Awal\n(${report.period.openingLabel})`,
      'Barang Masuk',
      'Total\n(Awal + Masuk)',
      'Keluar',
      ...(showAdj ? ['Penyesuaian'] : []),
      'Sisa Akhir',
    ],
  ];
  const body = rows.map((row, i) => [
    String(i + 1),
    `${row.name}\n${row.sku} · ${row.category}`,
    row.stockGroupLabel,
    qty(row, row.openingStock),
    row.inQty ? qty(row, row.inQty) : '-',
    qty(row, row.totalAvailable),
    row.outQty ? qty(row, row.outQty) : '-',
    ...(showAdj ? [row.adjustment ? `${row.adjustment > 0 ? '+' : ''}${qty(row, row.adjustment)}` : '-'] : []),
    qty(row, row.closingStock),
  ]);
  const foot = summarizeStockByUnit(rows).map((t) => [
    { content: `Subtotal ${t.unit} (${t.itemCount} jenis barang)`, colSpan: 3 },
    String(t.openingStock),
    String(t.inQty),
    String(t.totalAvailable),
    String(t.outQty),
    ...(showAdj ? [String(t.adjustment)] : []),
    String(t.closingStock),
  ]);

  autoTable(doc, {
    startY: 43,
    head,
    body: body.length ? body : [[{ content: 'Belum ada data barang pada periode ini.', colSpan: showAdj ? 9 : 8 }]],
    foot,
    showFoot: 'lastPage',
    theme: 'grid',
    margin: { left: marginX, right: marginX, bottom: 16 },
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.3, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], valign: 'middle' },
    headStyles: { fillColor: [226, 232, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: showAdj ? 52 : 62 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center', fontStyle: 'bold' },
      6: { halign: 'center' },
      7: { halign: 'center', fontStyle: showAdj ? 'normal' : 'bold' },
      8: { halign: 'center', fontStyle: 'bold' },
    },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Riwayat Stok ${report.period.label} · ${options.groupLabel}`, marginX, pageHeight - 8);
      doc.text(`Halaman ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    },
  });

  // Catatan & tanda tangan
  let y = ((doc as any).lastAutoTable?.finalY ?? 50) + 5;
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + 45 > pageHeight - 16) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.text(
    `* Total = Stok Awal + Barang Masuk. Sisa Akhir = Total - Keluar${showAdj ? ' ± Penyesuaian' : ''}. Subtotal dihitung per satuan dasar.`,
    marginX,
    y,
    { maxWidth: pageWidth - marginX * 2 }
  );
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const rightX = pageWidth / 2 + 10;
  doc.text('Mengetahui,', marginX, y + 5);
  doc.text(`Bandar Lampung, ${today}`, rightX, y);
  doc.text('Yang membuat laporan,', rightX, y + 5);
  doc.text('(.................................)', marginX, y + 28);
  doc.text('(.................................)', rightX, y + 28);

  const fileLabel = report.period.kind === 'year' ? `tahun-${report.period.value}` : `bulan-${report.period.value}`;
  doc.save(`riwayat-stok-${options.groupSlug}-${fileLabel}.pdf`);
}
