import type { jsPDF } from 'jspdf';

export async function addPdfLetterhead(doc: jsPDF, margin: number, ruleY: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = 82;
  const height = width * 138 / 719;
  const image = await fetch('/kop-pengajuan-atk.png')
    .then(async (response) => response.ok ? new Uint8Array(await response.arrayBuffer()) : null)
    .catch(() => null);
  if (image) {
    doc.addImage(image, 'PNG', (pageWidth - width) / 2, ruleY - height - 6, width, height);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('UNIVERSITAS TEKNOKRAT INDONESIA', pageWidth / 2, ruleY - 9, { align: 'center' });
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Bagian Umum dan Rumah Tangga', pageWidth / 2, ruleY - 2, { align: 'center' });
  doc.setLineWidth(0.6);
  doc.line(margin, ruleY, pageWidth - margin, ruleY);
}
