import { formatStock } from '@/lib/product-units';

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
  totals: {
    openingStock: number;
    inQty: number;
    totalAvailable: number;
    outQty: number;
    adjustment: number;
    closingStock: number;
    itemCount: number;
  };
  rows: StockPositionPdfRow[];
}

function qty(row: StockPositionPdfRow, value: number) {
  return value < 0 ? `-${formatStock(row, -value)}` : formatStock(row, value);
}

async function loadImageDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Buat & unduh PDF A4 Riwayat Stok (Stok Lama, Stok Baru, Total, Keluar, Sisa Akhir) di browser. */
export async function downloadStockPositionPdf(
  report: StockPositionPdfReport,
  options: { groupLabel: string; groupSlug: string; rows?: StockPositionPdfRow[] }
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;
  const rows = options.rows ?? report.rows;
  const showAdj = report.hasAdjustment;

  // Kop
  const logo = await loadImageDataUrl('/logo-yayasan.png');
  if (logo) doc.addImage(logo, 'PNG', marginX, 10, 13, 13);
  const textX = logo ? marginX + 16 : marginX;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text('UNIVERSITAS TEKNOKRAT INDONESIA', textX, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Bagian Umum dan Rumah Tangga', textX, 21);
  doc.setLineWidth(0.6);
  doc.line(marginX, 26, pageWidth - marginX, 26);

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
    `Jenis Stok: ${options.groupLabel}  ·  Periode: ${report.period.label}  ·  Dicetak: ${today}`,
    pageWidth / 2,
    39,
    { align: 'center' }
  );

  const head = [
    [
      'No',
      'Nama Barang',
      'Jenis',
      `Stok Lama\n(${report.period.openingLabel})`,
      'Stok Baru\n(Masuk)',
      'Total\n(Lama + Baru)',
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
  const sum = (key: keyof StockPositionPdfRow) => rows.reduce((acc, r) => acc + (r[key] as number), 0);
  const foot = rows.length
    ? [
        [
          { content: `TOTAL (${rows.length} barang)`, colSpan: 3 },
          String(sum('openingStock')),
          String(sum('inQty')),
          String(sum('totalAvailable')),
          String(sum('outQty')),
          ...(showAdj ? [String(sum('adjustment'))] : []),
          String(sum('closingStock')),
        ],
      ]
    : undefined;

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
    `* Total = Stok Lama + Stok Baru. Sisa Akhir = Total - Keluar${showAdj ? ' ± Penyesuaian' : ''}. Baris TOTAL menjumlahkan angka dalam satuan dasar masing-masing barang.`,
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
