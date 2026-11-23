import { personName } from '@/lib/deleted-account';

const TYPE_LABEL: Record<string, string> = {
  IN: 'Masuk',
  OUT: 'Keluar',
  ADJUSTMENT: 'Penyesuaian',
  REVERSAL: 'Pembatalan',
};

const SOURCE_LABEL: Record<string, string> = { WEB: 'Web', TELEGRAM: 'Telegram', SYSTEM: 'Sistem' };

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

function actorLabel(m: any) {
  if (m.source === 'TELEGRAM' && m.actor?.telegram?.username) return `@${m.actor.telegram.username}`;
  return personName(m.actor?.name, m.actorName, 'Sistem');
}

/** Ambil seluruh mutasi sesuai filter (API dibatasi 200 baris per halaman). */
export async function fetchAllMovements(filters: Record<string, string>, maxRows = 10000): Promise<any[]> {
  const items: any[] = [];
  for (let page = 1; items.length < maxRows; page++) {
    const query = new URLSearchParams({ ...filters, limit: '200', page: String(page) }).toString();
    const res = await fetch(`/api/stock/movements?${query}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || 'Data riwayat stok gagal dimuat.');
    items.push(...(data?.items || []));
    if (!data?.totalPages || page >= data.totalPages) break;
  }
  return items.slice(0, maxRows);
}

/** Buat & unduh PDF A4 (landscape) Riwayat Stok dari menu Transaksi. */
export async function downloadStockMovementsPdf(movements: any[], filterLines: string[]) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 10;

  const logo = await loadImageDataUrl('/logo-yayasan.png');
  if (logo) doc.addImage(logo, 'PNG', marginX, 8, 12, 12);
  const textX = logo ? marginX + 15 : marginX;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('UNIVERSITAS TEKNOKRAT INDONESIA', textX, 13.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Bagian Umum dan Rumah Tangga', textX, 18.5);
  doc.setLineWidth(0.6);
  doc.line(marginX, 23, pageWidth - marginX, 23);

  const now = new Date();
  const today = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('LAPORAN RIWAYAT STOK (MUTASI BARANG)', pageWidth / 2, 30, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text([...filterLines, `Jumlah transaksi: ${movements.length} · Dicetak: ${today}`].join('  ·  '), pageWidth / 2, 35, {
    align: 'center',
    maxWidth: pageWidth - marginX * 2,
  });

  const fmtTime = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let totalIn = 0;
  let totalOut = 0;
  const body = movements.map((m, i) => {
    const delta = Number(m.stockAfter) - Number(m.stockBefore);
    if (m.type === 'IN') totalIn += m.quantity;
    if (m.type === 'OUT') totalOut += m.quantity;
    const unit = m.product?.unit || '';
    return [
      String(i + 1),
      fmtTime.format(new Date(m.createdAt)),
      `${m.product?.name || '-'}\n${m.product?.sku || ''}`,
      TYPE_LABEL[m.type] || m.type,
      `${delta > 0 ? '+' : delta < 0 ? '-' : ''}${m.quantity} ${unit}`.trim(),
      `${m.stockBefore} -> ${m.stockAfter}`,
      actorLabel(m),
      SOURCE_LABEL[m.source] || m.source,
      m.notes || '-',
    ];
  });

  autoTable(doc, {
    startY: 39,
    head: [['No', 'Waktu', 'Nama Barang', 'Aktivitas', 'Jumlah', 'Stok Sebelum -> Sesudah', 'Pelaku', 'Sumber', 'Catatan']],
    body: body.length ? body : [[{ content: 'Tidak ada transaksi pada filter ini.', colSpan: 9 }]],
    foot: body.length
      ? [[{ content: `Total barang masuk: ${totalIn}   ·   Total barang keluar: ${totalOut}   (dalam satuan dasar masing-masing barang)`, colSpan: 9 }]]
      : undefined,
    showFoot: 'lastPage',
    theme: 'grid',
    margin: { left: marginX, right: marginX, bottom: 14 },
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.3, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], valign: 'middle' },
    headStyles: { fillColor: [226, 232, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { cellWidth: 30 },
      2: { cellWidth: 62 },
      3: { halign: 'center', cellWidth: 21 },
      4: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 28 },
      6: { cellWidth: 30 },
      7: { halign: 'center', cellWidth: 17 },
    },
    didParseCell: (hook) => {
      if (hook.section !== 'body' || hook.column.index !== 4) return;
      const text = String(hook.cell.raw ?? '');
      if (text.startsWith('+')) hook.cell.styles.textColor = [4, 120, 87];
      else if (text.startsWith('-')) hook.cell.styles.textColor = [159, 18, 57];
    },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Riwayat Stok · StockFlow', marginX, pageHeight - 7);
      doc.text(`Halaman ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - marginX, pageHeight - 7, { align: 'right' });
      doc.setTextColor(0, 0, 0);
    },
  });

  const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
  doc.save(`riwayat-stok-${stamp}.pdf`);
}
