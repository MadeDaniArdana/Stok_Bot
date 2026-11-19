/**
 * Reset seluruh data persediaan, transaksi, distribusi, tugas, notifikasi, dan log,
 * lalu mengisi ulang master kategori, master barang, dan saldo awal mutasi stok
 * dari dokumen ATK.pdf (48 item) dan LOGISTIK.pdf (28 item).
 *
 * Akun pengguna (User), tautan Telegram (TelegramUser), dan admin bot (TelegramAdmin)
 * tetap dipertahankan.
 *
 * Jalankan: npm run db:seed-pdf
 */
const { PrismaClient } = require('@prisma/client');
const { seedListrikAndTemplates } = require('./seed-listrik-and-templates');
const prisma = new PrismaClient();

const ATK_DATE = new Date('2025-09-19T09:00:00+07:00');
const LOGISTIK_PRIOR_DATE = new Date('2026-10-01T08:00:00+07:00');
const LOGISTIK_DATE = new Date('2026-10-02T09:00:00+07:00');

const CATEGORIES = [
  {
    id: 'cat-paper',
    name: 'Kebutuhan Kertas & Cetak',
    stockGroup: 'ATK',
    description: 'Kertas HVS, kertas bergaris, map, odner, business file, dan perlengkapan berkas.',
  },
  {
    id: 'cat-atk',
    name: 'Alat Tulis Kantor (ATK)',
    stockGroup: 'ATK',
    description: 'Pena, pensil, spidol, stapler, klip, lakban, isolasi, gunting, cutter, dan perlengkapan kantor lainnya.',
  },
  {
    id: 'cat-vitamin',
    name: 'Vitamin & Kesehatan',
    stockGroup: 'LOGISTIK',
    description: 'Vitamin dan suplemen untuk petugas CS, satpam, dan stok.',
  },
  {
    id: 'cat-satpam',
    name: 'Logistik Satpam',
    stockGroup: 'LOGISTIK',
    description: 'Konsumsi pos satpam: mie, teh, susu, gula, dan kopi.',
  },
  {
    id: 'cat-clean',
    name: 'Kebersihan & Sanitasi',
    stockGroup: 'LOGISTIK',
    description: 'Perlengkapan kebersihan petugas CS, sabun, pembersih, pewangi, tisu, sapu, dan plastik sampah.',
  },
  {
    id: 'cat-elektronik',
    name: 'Elektronik',
    stockGroup: 'LISTRIK',
    description: 'Lampu, kabel listrik, stop kontak, saklar, dan perlengkapan instalasi listrik gedung.',
  },
];

// [categoryId, name, unit, packUnit, packSize, priorQty, procuredQty, minimumStock, supplier, price, spec, keperluan]
const ATK_ITEMS = [
  // cat-paper (9 items)
  ['cat-paper', 'Kertas HVS A4 Sidu 75 gr', 'rim', null, null, 0, 199, 20, 'Toko Kim-Kim', 44500, 'A4 Sidu 75 gr', 'FTIK (40), FSIP (30), FEB (30), Kemahasiswaan (10), TU Warek (8), LPPM (6), LPBM (15), TU SI (11), TU IF (10), Perpustakaan (3), Informasi (16), Stok (20)'],
  ['cat-paper', 'Kertas HVS F4 Sidu 75 gr', 'rim', null, null, 0, 74, 10, 'Toko Kim-Kim', 50500, 'F4 Sidu 75 gr', 'FTIK (15), FSIP (15), FEB (15), TU Warek (1), Kemahasiswaan (3), LPBM (10), TU IF (2), Informasi (8), Stok (5)'],
  ['cat-paper', 'Kertas HVS F4 Sidu 60 gr', 'rim', null, null, 0, 10, 2, 'Toko Kim-Kim', 43500, 'F4 Sidu 60 gr', 'FEB'],
  ['cat-paper', 'Kertas Bergaris Folio/F4', 'rim', null, null, 0, 2, 1, 'Toko Kim-Kim', 23000, 'Folio/F4', 'FSIP'],
  ['cat-paper', 'Kertas HVS Warna F4 (Biru & Hijau)', 'rim', null, null, 0, 6, 2, 'Toko Kim-Kim', 54500, 'F4 Warna Biru 5 & Hijau 1', 'LPBM, FSIP'],
  ['cat-paper', 'Map Kabita (Pink & Biru)', 'pack', null, null, 0, 13, 3, 'Toko Kim-Kim', 30000, 'Kabita Pink, Biru', 'LPPM, Kemahasiswaan, TU Prodi, LPBM'],
  ['cat-paper', 'Odner Besar Hitam Gobi', 'pcs', null, null, 0, 24, 5, 'Toko Kim-Kim', 19000, 'Hitam Gobi', 'LPBM'],
  ['cat-paper', 'Business File (Biru, Kuning, Orange)', 'pack', null, null, 0, 25, 5, 'Toko Kim-Kim', 24000, 'Warna Biru, Kuning, Orange', 'FEB, TU Prodi, Informasi, LPBM'],
  ['cat-paper', 'PP Pocket Benex F4', 'pack', null, null, 0, 15, 3, 'Toko Kim-Kim', 19000, 'F4', 'LPPM, LPBM'],

  // cat-atk (39 items)
  ['cat-atk', 'Pena Tizzo Hitam', 'pcs', 'lusin', 12, 0, 4, 12, 'Toko Kim-Kim', 39000, 'Tizzo Hitam', 'FEB, LPPM, Kemahasiswaan, TU Warek, Perpustakaan, TU Prodi'],
  ['cat-atk', 'Pena Tizzo Biru', 'pcs', 'lusin', 12, 0, 1, 3, 'Toko Kim-Kim', 39000, 'Tizzo Biru', 'TU Warek'],
  ['cat-atk', 'Pena Kenko Biru Easy Jel 0,5mm', 'pcs', 'lusin', 12, 0, 3, 12, 'Toko Kim-Kim', 27000, 'Easy Jel 0,5mm', 'TU Warek, Informasi'],
  ['cat-atk', 'Pena Kenko Hitam Easy Jel 0,5mm', 'pcs', 'lusin', 12, 0, 6, 12, 'Toko Kim-Kim', 27000, 'Easy Jel 0,5mm', 'FEB, Informasi, Kemahasiswaan, TU Warek, TU Prodi'],
  ['cat-atk', 'Refill Pena Joyko Biru 1 mm', 'kotak', null, null, 0, 3, 1, 'Toko Kim-Kim', 29000, 'Joyko Biru 1 mm', 'FSIP, FEB, Kemahasiswaan'],
  ['cat-atk', 'Pensil Faber-Castell', 'pcs', null, null, 0, 11, 3, 'Toko Kim-Kim', 4500, 'Faber-Castell', 'FEB, LPPM, Informasi'],
  ['cat-atk', 'Peruncing Faber-Castell Kecil', 'pcs', null, null, 0, 6, 2, 'Toko Kim-Kim', 5000, 'F. Castel Kecil', 'FEB, Informasi'],
  ['cat-atk', 'Penggaris Besi', 'pcs', null, null, 0, 4, 1, 'Toko Kim-Kim', 4500, 'Besi', 'LPPM, Perpustakaan, Informasi'],
  ['cat-atk', 'Baterai ABC A2', 'kotak', null, null, 0, 80, 10, 'Toko Kim-Kim', 54000, 'ABC A2', 'Stok Kegiatan UTI'],
  ['cat-atk', 'Baterai ABC A3', 'renteng', null, null, 0, 36, 5, 'Toko Kim-Kim', 24000, 'ABC A3', 'Stok Remot AC'],
  ['cat-atk', 'Lakban Handeru Bening', 'pcs', null, null, 0, 23, 5, 'Toko Kim-Kim', 7500, 'Handeru Bening', 'FSIP, FEB, LPPM, Kemahasiswaan, TU Warek, Perpustakaan, Informasi, LPBM'],
  ['cat-atk', 'Lakban Handeru Hitam', 'pcs', null, null, 0, 2, 1, 'Toko Kim-Kim', 10500, 'Handeru Hitam', 'FSIP, LPPM'],
  ['cat-atk', 'Isolasi Handeru 1/2', 'pcs', null, null, 0, 32, 5, 'Toko Kim-Kim', 1750, 'Handeru 1/2', 'FEB, FSIP, LPPM, Kemahasiswaan, TU Warek, Perpustakaan, Informasi, LPBM'],
  ['cat-atk', 'Tape Dispenser Isolasi Joyko TD 103', 'pcs', null, null, 0, 2, 1, 'Toko Kim-Kim', 20000, 'Joyko TD 103', 'Perpustakaan, LPBM'],
  ['cat-atk', 'Tape Dispenser Isolasi Lion No. 50', 'pcs', null, null, 0, 3, 1, 'Toko Kim-Kim', 25000, 'Merk Lion No. 50', 'TU Warek, Perpustakaan, Informasi'],
  ['cat-atk', 'Stapler Max HD10', 'pcs', null, null, 0, 8, 2, 'Toko Kim-Kim', 15000, 'Max HD10', 'FEB, TU Warek, Informasi, LPBM'],
  ['cat-atk', 'Isi Stapler Kenko No. 10-1M', 'box', null, null, 0, 4, 1, 'Toko Kim-Kim', 22000, 'Kenko No.10-1M', 'Kemahasiswaan, Perpustakaan'],
  ['cat-atk', 'Double Tape Kenko Kecil 12mm', 'pcs', null, null, 0, 20, 4, 'Toko Kim-Kim', 2600, 'Kenko kecil 12MM', 'FSIP, LPPM, TU Warek, Informasi'],
  ['cat-atk', 'Double Tape Kenko Besar 24mm', 'pcs', null, null, 0, 13, 3, 'Toko Kim-Kim', 5000, 'Kenko Besar 24MM', 'FEB, LPPM, Kemahasiswaan, TU Warek'],
  ['cat-atk', 'Gunting Besar Kenko 848', 'pcs', null, null, 0, 4, 1, 'Toko Kim-Kim', 10000, 'Kenko 848', 'TU Warek, Perpustakaan, Informasi, LPBM'],
  ['cat-atk', 'Gunting Sedang Kenko 838', 'pcs', null, null, 0, 6, 2, 'Toko Kim-Kim', 7000, 'Kenko 838', 'FEB, TU Warek, Perpustakaan, Informasi, LPBM'],
  ['cat-atk', 'Cutter Kenko L150', 'pcs', null, null, 0, 6, 2, 'Toko Kim-Kim', 13000, 'Kenko L150', 'FEB, TU Warek, Informasi, LPBM'],
  ['cat-atk', 'Isi Cutter Kenko L150', 'tube', null, null, 0, 6, 2, 'Toko Kim-Kim', 5500, 'Kenko L150', 'FEB, Informasi, LPBM'],
  ['cat-atk', 'Pembolong Kertas Besar Punch Joyko JK85B', 'pcs', null, null, 0, 2, 1, 'Toko Kim-Kim', 44000, 'Punch JOYKO JK85B', 'Informasi, LPBM'],
  ['cat-atk', 'Stabilo Boss (Hijau, Kuning, Pink, Orange, Pastel)', 'pcs', null, null, 0, 17, 4, 'Toko Kim-Kim', 9500, 'Hijau, Kuning, Pink, Orange, Pastel', 'FEB, Kemahasiswaan, TU Warek, Perpustakaan, TU Prodi, Informasi, LPBM'],
  ['cat-atk', 'Paper Clip Kenko No. 3', 'box', null, null, 0, 10, 2, 'Toko Kim-Kim', 16000, 'Kenko No. 3', 'FEB, LPPM, Kemahasiswaan, TU Warek, Perpustakaan, TU Prodi, Informasi, LPBM'],
  ['cat-atk', 'Binder Clip Kenko 105', 'kotak', null, null, 0, 14, 3, 'Toko Kim-Kim', 2600, 'Kenko 105', 'FEB, TU Warek, Informasi'],
  ['cat-atk', 'Binder Clip Kenko 155', 'kotak', null, null, 0, 15, 3, 'Toko Kim-Kim', 6000, 'Kenko 155', 'FEB, LPPM, Perpustakaan, Informasi'],
  ['cat-atk', 'Binder Clip Kenko No. 200', 'kotak', null, null, 0, 2, 1, 'Toko Kim-Kim', 10500, 'Kenko No. 200', 'Perpustakaan'],
  ['cat-atk', 'Binder Clip Kenko No. 260', 'kotak', null, null, 0, 2, 1, 'Toko Kim-Kim', 15500, 'Kenko No. 260', 'Perpustakaan'],
  ['cat-atk', 'Binder Clip Kenko No. 280', 'kotak', null, null, 0, 2, 1, 'Toko Kim-Kim', 23500, 'Kenko No. 280', 'Perpustakaan'],
  ['cat-atk', 'Sticky Note Besar', 'pcs', null, null, 0, 7, 2, 'Toko Kim-Kim', 15000, 'Besar', 'TU Warek, TU Prodi, LPBM'],
  ['cat-atk', 'Tinta Spidol Snowman Whiteboard Biru', 'pcs', null, null, 0, 6, 2, 'Toko Kim-Kim', 15000, 'Snowman White Board Marking Ink Biru', 'FSIP'],
  ['cat-atk', 'Tinta Spidol Snowman Whiteboard Hitam', 'pcs', null, null, 0, 12, 3, 'Toko Kim-Kim', 15000, 'Snowman White Board Marking Ink Hitam', 'FSIP'],
  ['cat-atk', 'Spidol Whiteboard Snowman Hitam', 'pcs', 'lusin', 12, 0, 1, 3, 'Toko Kim-Kim', 84000, 'Snowman Hitam', 'FEB, LPPM'],
  ['cat-atk', 'Lem Kenko Stick 25gr', 'box', null, null, 0, 1, 0, 'Toko Kim-Kim', 60000, 'Kenko Stick 25gr', 'LPPM, TU Prodi'],
  ['cat-atk', 'Tipe-X Kenko 01', 'pcs', null, null, 0, 5, 2, 'Toko Kim-Kim', 4500, 'Kenko 01', 'Informasi, LPBM'],
  ['cat-atk', 'Post It Sign Here', 'pcs', null, null, 0, 6, 2, 'Toko Kim-Kim', 7000, '-', 'TU Warek'],
  ['cat-atk', 'Tinta Stamp Pad Biru Joyko', 'pcs', null, null, 0, 2, 1, 'Toko Kim-Kim', 5500, 'Joyko', 'TU Warek'],
];

const LOGISTIK_ITEMS = [
  // cat-vitamin (5 items)
  ['cat-vitamin', 'Becom-C (Vitamin C)', 'tablet', null, null, 1, 500, 50, 'Apotik Harapan', 2170, 'Vitamin C', 'Vitamin CS, Satpam dan Stok'],
  ['cat-vitamin', 'CDR (Vitamin C)', 'kotak', null, null, 0, 13, 3, 'Apotik Harapan', 80000, 'Vitamin C', 'Vitamin CS, Satpam dan Stok'],
  ['cat-vitamin', 'Redokson (Vitamin C)', 'kotak', null, null, 0, 1, 0, 'Apotik Harapan', 65000, 'Vitamin & Mineral', 'Vitamin CS, Satpam dan Stok'],
  ['cat-vitamin', 'Tolak Angin', 'pcs', 'kotak', 12, 0, 1, 4, 'Apotik Harapan', 48000, 'Vitamin & Mineral', 'Vitamin CS, Satpam dan Stok'],
  ['cat-vitamin', 'Susu Beruang', 'pcs', 'krat', 30, 1, 7, 30, 'Puti Minang Grosir', 285000, 'Vitamin & Mineral', 'Vitamin CS, Satpam dan Stok'],

  // cat-satpam (5 items)
  ['cat-satpam', 'Mie Indomie Rebus', 'pcs', 'dus', 40, 2, 6, 40, 'Puti Minang Grosir', 118000, 'Indomie Rebus', 'Logistik Satpam'],
  ['cat-satpam', 'Teh Kotak Sari Wangi', 'kotak', null, null, 0, 6, 2, 'Puti Minang Grosir', 6000, 'Sari Wangi', 'Logistik Satpam'],
  ['cat-satpam', 'Susu Sachet Bendera', 'pack', null, null, 0, 35, 5, 'Puti Minang Grosir', 8000, 'Bendera', 'Logistik Satpam'],
  ['cat-satpam', 'Gula Putih', 'gram', 'kg', 1000, 1, 10, 2000, 'Puti Minang Grosir', 18500, '-', 'Logistik Satpam'],
  ['cat-satpam', 'Kopi Jempol 0,5 Ons', 'pack', null, null, 2, 6, 2, 'Puti Minang Grosir', 67500, 'Jempol 0,5 Ons', 'Logistik Satpam'],

  // cat-clean (18 items)
  ['cat-clean', 'Pengharum Kamar Mandi SOS Carbol 800gr', 'dus', null, null, 0, 3, 1, 'Alfamart', 142800, 'SOS Carbol 800gr', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Sabun Cuci Piring Sunlight', 'pcs', null, null, 0, 24, 5, 'Alfamart', 10000, 'Sunglight', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Sabun Colek Wings 1000 Biru', 'dus', null, null, 0, 2, 1, 'Puti Minang Grosir', 60000, 'Wings 1000 Biru', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Ijo-Ijo Scotch Brite', 'pcs', null, null, 0, 25, 5, 'Chandra Departemen Store', 8500, 'Scote Brite', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Spons Cuci Piring Scotch Brite', 'pcs', null, null, 0, 2, 1, 'Chandra Departemen Store', 4000, 'Scote Brite', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Pel Lantai Refill Clean Matic', 'pcs', null, null, 0, 8, 2, 'Chandra Departemen Store', 119000, 'Refil Clean Metic', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Pembersih Kaca Refill Cling', 'pcs', null, null, 1, 10, 2, 'Chandra Departemen Store', 3600, 'Refil Cling', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Kapur Barus Besar Dahlia Warna Warni', 'pcs', null, null, 0, 10, 2, 'Chandra Departemen Store', 24000, 'Dahlia warna warni', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Pewangi Ruangan Glade, Stella, Dahlia', 'kaleng', null, null, 1, 20, 5, 'Chandra Departemen Store', 33900, 'Glade, Stella, Dahlia', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Baygon Semprot 600 ml', 'kaleng', null, null, 0, 5, 2, 'Chandra Departemen Store', 34500, 'Semprot 600 ml', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Tissue Nice Refill Besar', 'pcs', null, null, 0, 4, 1, 'Chandra Departemen Store', 40500, 'Nice Refill Besar', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Tissue Mobil Nice Refill Kecil', 'ball', null, null, 0, 12, 3, 'Chandra Departemen Store', 11000, 'Nice Refill kecil', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Sapu Lantai Nagata', 'pcs', null, null, 0, 10, 2, 'Chandra Departemen Store', 25000, 'Nagata', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Sapu Lidi', 'pcs', null, null, 0, 10, 2, 'Chandra Departemen Store', 15000, '-', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Keset Welcome', 'pcs', null, null, 0, 8, 2, 'Chandra Departemen Store', 25000, 'Welcome', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Sikat Lantai', 'pcs', null, null, 0, 6, 2, 'Chandra Departemen Store', 10000, '-', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Plastik Sampah Uk. 100 x 120', 'pack', null, null, 5, 40, 10, 'Chandra Departemen Store', 25000, 'Uk. 100 x 120', 'Perlengkapan Petugas Kebersihan'],
  ['cat-clean', 'Pewangi Karpet Ginger Kecil', 'botol', null, null, 5, 10, 3, 'Chandra Departemen Store', 33000, 'Ginger Kecil', 'Perlengkapan Petugas Kebersihan'],
];

function skuPrefix(categoryName) {
  return (
    categoryName
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'KATEGORI'
  );
}

async function main() {
  console.log('Mereset data persediaan dan mengimpor barang dari ATK.pdf & LOGISTIK.pdf...');

  // 1. Hapus seluruh data operasional & master lama dalam 1 transaksi (akun User/Telegram dipertahankan).
  await prisma.$transaction(
    async (tx) => {
      await tx.notification.deleteMany();
      await tx.distributionProof.deleteMany();
      await tx.distributionItem.deleteMany();
      await tx.distribution.deleteMany();
      await tx.distributionTemplateItem.deleteMany();
      await tx.distributionTemplate.deleteMany();
      await tx.installationTask.deleteMany();
      await tx.stockMovement.deleteMany();
      await tx.product.deleteMany();
      await tx.category.deleteMany();
      await tx.errorLog.deleteMany();
      await tx.telegramUpdate.deleteMany();
      await tx.telegramConversation.deleteMany();
    },
    { timeout: 60_000, maxWait: 10_000 }
  );

  // 2. Ambil akun admin yang dipertahankan sebagai actorUserId mutasi awal.
  const admin =
    (await prisma.user.findUnique({ where: { id: 'u-admin-01' } })) ||
    (await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true }, orderBy: { createdAt: 'asc' } }));

  // 3. Buat 6 kategori bersih.
  const categoryMap = new Map();
  const skuCounters = new Map();
  for (const cat of CATEGORIES) {
    const created = await prisma.category.create({ data: cat });
    categoryMap.set(cat.id, created);
    skuCounters.set(cat.id, 0);
  }

  function nextSku(categoryId) {
    const category = categoryMap.get(categoryId);
    const nextNum = (skuCounters.get(categoryId) || 0) + 1;
    skuCounters.set(categoryId, nextNum);
    return `${skuPrefix(category.name)}-${String(nextNum).padStart(3, '0')}`;
  }

  const allEntries = [
    ...ATK_ITEMS.map((item) => ({ sourcePdf: 'ATK', item })),
    ...LOGISTIK_ITEMS.map((item) => ({ sourcePdf: 'LOGISTIK', item })),
  ];

  let productCount = 0;
  let movementCount = 0;

  for (const { sourcePdf, item } of allEntries) {
    const [
      categoryId,
      name,
      unit,
      packUnit,
      packSize,
      priorQty,
      procuredQty,
      minimumStock,
      supplier,
      price,
      spec,
      keperluan,
    ] = item;

    const factor = packSize || 1;
    const pdfUnit = packUnit || unit;
    const priorBase = priorQty * factor;
    const procuredBase = procuredQty * factor;
    const totalBaseStock = priorBase + procuredBase;
    const sku = nextSku(categoryId);

    const description = `Spesifikasi: ${spec} | Keperluan: ${keperluan} | Supplier: ${supplier} | Harga: Rp ${price.toLocaleString('id-ID')}`;
    const movements = [];

    if (priorBase > 0) {
      movements.push({
        actorUserId: admin?.id ?? null,
        type: 'IN',
        quantity: priorBase,
        stockBefore: 0,
        stockAfter: priorBase,
        source: 'SYSTEM',
        notes: 'Saldo awal (Keterangan Stok Pengajuan Logistik Oktober 2026)',
        createdAt: LOGISTIK_PRIOR_DATE,
      });
    }

    const procurementNote =
      sourcePdf === 'ATK'
        ? `Pengadaan ATK Semester Ganjil TA 2025/2026 dari ${supplier} (${procuredQty} ${pdfUnit} @ Rp ${price.toLocaleString('id-ID')})`
        : `Pengadaan Logistik Oktober 2026 dari ${supplier} (${procuredQty} ${pdfUnit} @ Rp ${price.toLocaleString('id-ID')})`;

    movements.push({
      actorUserId: admin?.id ?? null,
      type: 'IN',
      quantity: procuredBase,
      stockBefore: priorBase,
      stockAfter: totalBaseStock,
      source: 'SYSTEM',
      notes: procurementNote,
      createdAt: sourcePdf === 'ATK' ? ATK_DATE : LOGISTIK_DATE,
    });

    await prisma.product.create({
      data: {
        sku,
        name,
        description,
        categoryId,
        unit,
        packUnit,
        packSize,
        currentStock: totalBaseStock,
        minimumStock,
        isActive: true,
        movements: { create: movements },
      },
    });

    productCount += 1;
    movementCount += movements.length;
  }

  console.log(`Selesai: ${CATEGORIES.length} kategori, ${productCount} barang (${ATK_ITEMS.length} ATK, ${LOGISTIK_ITEMS.length} Logistik), ${movementCount} mutasi stok masuk.`);
  await seedListrikAndTemplates(prisma);
}

main()
  .catch((error) => {
    console.error('Gagal melakukan reset & impor PDF:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

