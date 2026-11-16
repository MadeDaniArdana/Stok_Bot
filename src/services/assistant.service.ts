import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAIProvider, type AITool, type ChatTurn, type ToolCall } from '@/lib/ai';

/**
 * Asisten AI StockFlow: menjawab pertanyaan tentang stok, tugas pemasangan, dan riwayat stok.
 * Semua alat hanya MEMBACA data; asisten tidak dapat mengubah apa pun.
 */

const TOOLS: AITool[] = [
  {
    name: 'cek_stok',
    description:
      'Daftar barang beserta stok saat ini, stok minimum, satuan, kategori, dan status (aman/menipis/habis). ' +
      'Pakai untuk pertanyaan tentang jumlah stok atau barang yang hampir habis.',
    parameters: {
      type: 'object',
      properties: {
        kata_kunci: { type: 'string', description: 'Sebagian nama barang, SKU, atau kategori. Kosongkan untuk semua barang.' },
        status: { type: 'string', description: 'Filter status stok.', enum: ['semua', 'menipis', 'habis'] },
      },
    },
  },
  {
    name: 'cari_tugas_pemasangan',
    description:
      'Mencari tugas pemasangan/pengambilan barang yang dibuat admin lewat Telegram: barang, jumlah, pemasang, lokasi, ' +
      'status (selesai = sudah kirim foto bukti, menunggu = belum), waktu dibuat dan selesai.',
    parameters: {
      type: 'object',
      properties: {
        pemasang: { type: 'string', description: 'Sebagian nama pemasang, misalnya "bimo".' },
        lokasi: { type: 'string', description: 'Sebagian nama lokasi, misalnya "gsg".' },
        barang: { type: 'string', description: 'Sebagian nama barang, misalnya "lampu".' },
        status: { type: 'string', description: 'Status tugas.', enum: ['semua', 'selesai', 'menunggu'] },
        dari_tanggal: { type: 'string', description: 'Tanggal awal (YYYY-MM-DD), berdasarkan waktu tugas dibuat.' },
        sampai_tanggal: { type: 'string', description: 'Tanggal akhir (YYYY-MM-DD), inklusif.' },
      },
    },
  },
  {
    name: 'riwayat_stok',
    description:
      'Riwayat barang masuk dan keluar (mutasi stok) beserta total per jenis. Pakai untuk pertanyaan seperti ' +
      '"berapa lampu keluar bulan ini" atau "kapan terakhir barang X masuk".',
    parameters: {
      type: 'object',
      properties: {
        barang: { type: 'string', description: 'Sebagian nama barang atau SKU.' },
        jenis: { type: 'string', description: 'Jenis mutasi.', enum: ['semua', 'masuk', 'keluar'] },
        dari_tanggal: { type: 'string', description: 'Tanggal awal (YYYY-MM-DD).' },
        sampai_tanggal: { type: 'string', description: 'Tanggal akhir (YYYY-MM-DD), inklusif.' },
      },
    },
  },
];

const TIMEZONE = 'Asia/Jakarta';

function str(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Rentang tanggal dalam WIB (UTC+7). */
function dateRange(from: unknown, to: unknown): Prisma.DateTimeFilter | undefined {
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  const range: Prisma.DateTimeFilter = {};
  if (isDate(str(from))) range.gte = new Date(`${str(from)}T00:00:00+07:00`);
  if (isDate(str(to))) range.lte = new Date(`${str(to)}T23:59:59.999+07:00`);
  return range.gte || range.lte ? range : undefined;
}

function formatDate(date: Date | null) {
  return date ? date.toLocaleString('id-ID', { timeZone: TIMEZONE, dateStyle: 'medium', timeStyle: 'short' }) : null;
}

function nameFilter(query: string): Prisma.StringFilter {
  return { contains: query, mode: 'insensitive' };
}

async function cekStok(args: Record<string, unknown>) {
  const keyword = str(args.kata_kunci);
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(keyword
        ? { OR: [{ name: nameFilter(keyword) }, { sku: nameFilter(keyword) }, { category: { name: nameFilter(keyword) } }] }
        : {}),
    },
    include: { category: { select: { name: true } } },
    orderBy: { name: 'asc' },
    take: 100,
  });

  const rows = products
    .map((product) => ({
      nama: product.name,
      sku: product.sku,
      kategori: product.category?.name ?? '-',
      stok: product.currentStock,
      minimum: product.minimumStock,
      satuan: product.unit,
      status: product.currentStock === 0 ? 'habis' : product.currentStock <= product.minimumStock ? 'menipis' : 'aman',
    }))
    .filter((row) => {
      const status = str(args.status);
      if (status === 'habis') return row.status === 'habis';
      if (status === 'menipis') return row.status !== 'aman';
      return true;
    });

  return { jumlah_barang: rows.length, barang: rows.slice(0, 50) };
}

async function cariTugas(args: Record<string, unknown>) {
  const status = str(args.status);
  const where: Prisma.InstallationTaskWhereInput = {
    ...(str(args.pemasang) ? { assigneeName: nameFilter(str(args.pemasang)) } : {}),
    ...(str(args.lokasi) ? { location: nameFilter(str(args.lokasi)) } : {}),
    ...(str(args.barang) ? { product: { name: nameFilter(str(args.barang)) } } : {}),
    ...(status === 'selesai' ? { status: 'COMPLETED' } : status === 'menunggu' ? { status: 'PENDING' } : {}),
    ...(dateRange(args.dari_tanggal, args.sampai_tanggal) ? { createdAt: dateRange(args.dari_tanggal, args.sampai_tanggal) } : {}),
  };

  const [total, tasks] = await Promise.all([
    prisma.installationTask.count({ where }),
    prisma.installationTask.findMany({
      where,
      include: { product: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  return {
    jumlah_tugas: total,
    ditampilkan: tasks.length,
    tugas: tasks.map((task) => ({
      barang: task.product.name,
      jumlah: `${task.quantity} ${task.product.unit}`,
      pemasang: task.assigneeName,
      lokasi: task.location,
      catatan: task.notes,
      status: task.status === 'COMPLETED' ? 'selesai (foto terkirim)' : 'menunggu foto',
      dibuat: formatDate(task.createdAt),
      selesai: formatDate(task.completedAt),
    })),
  };
}

async function riwayatStok(args: Record<string, unknown>) {
  const jenis = str(args.jenis);
  const keyword = str(args.barang);
  const where: Prisma.StockMovementWhereInput = {
    ...(keyword ? { product: { OR: [{ name: nameFilter(keyword) }, { sku: nameFilter(keyword) }] } } : {}),
    ...(jenis === 'masuk' ? { type: 'IN' } : jenis === 'keluar' ? { type: 'OUT' } : {}),
    ...(dateRange(args.dari_tanggal, args.sampai_tanggal) ? { createdAt: dateRange(args.dari_tanggal, args.sampai_tanggal) } : {}),
  };

  const [totals, movements] = await Promise.all([
    prisma.stockMovement.groupBy({ by: ['type'], where, _sum: { quantity: true }, _count: true }),
    prisma.stockMovement.findMany({
      where,
      include: { product: { select: { name: true, unit: true } }, actor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const label: Record<string, string> = { IN: 'masuk', OUT: 'keluar', ADJUSTMENT: 'penyesuaian', REVERSAL: 'pembatalan' };
  return {
    total_per_jenis: totals.map((row) => ({ jenis: label[row.type] ?? row.type, transaksi: row._count, jumlah: row._sum.quantity ?? 0 })),
    ditampilkan: movements.length,
    riwayat: movements.map((movement) => ({
      waktu: formatDate(movement.createdAt),
      barang: movement.product.name,
      jenis: label[movement.type] ?? movement.type,
      jumlah: `${movement.quantity} ${movement.product.unit}`,
      stok_sesudah: movement.stockAfter,
      oleh: movement.actor?.name ?? '-',
      catatan: movement.notes,
    })),
  };
}

async function runTool(call: ToolCall) {
  switch (call.name) {
    case 'cek_stok':
      return cekStok(call.args);
    case 'cari_tugas_pemasangan':
      return cariTugas(call.args);
    case 'riwayat_stok':
      return riwayatStok(call.args);
    default:
      return { error: `Alat "${call.name}" tidak dikenal.` };
  }
}

function systemPrompt() {
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // YYYY-MM-DD
  const dayName = now.toLocaleDateString('id-ID', { timeZone: TIMEZONE, weekday: 'long' });
  return [
    'Kamu adalah asisten StockFlow, sistem persediaan barang (inventori) kampus.',
    `Hari ini ${dayName}, ${today} (zona waktu WIB). Pakai ini untuk menghitung "hari ini", "minggu ini", "bulan ini", dan sebagainya.`,
    'Konteks: admin membuat tugas pemasangan/pengambilan barang lewat bot Telegram; pemasang mengirim foto bukti lewat link; stok berkurang setelah foto terkirim. Stok bertambah lewat menu Barang Masuk di web.',
    'Selalu ambil data dengan alat yang tersedia sebelum menjawab. Jangan mengarang angka, nama, atau tanggal.',
    'Jika data tidak ditemukan, katakan dengan jelas. Kamu hanya bisa membaca data, tidak bisa mengubah stok atau membuat tugas.',
    'Jawab dalam bahasa Indonesia yang singkat dan jelas. Gunakan teks biasa tanpa format markdown (tanpa ** atau #); untuk daftar pakai tanda "- " di awal baris.',
  ].join('\n');
}

export const MAX_HISTORY = 12;
export const MAX_MESSAGE_LENGTH = 1000;

export class AssistantService {
  static async ask(history: ChatTurn[]) {
    const provider = getAIProvider();
    const answer = await provider.chat({
      system: systemPrompt(),
      history: history.slice(-MAX_HISTORY),
      tools: TOOLS,
      runTool,
    });
    // Jaga-jaga jika model tetap memakai markdown tebal/judul.
    return answer.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '');
  }
}
