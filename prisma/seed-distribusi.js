/**
 * Data contoh untuk fitur Jenis Stok + Form Distribusi, diambil dari formulir kertas bagian umum:
 * - Form Distribusi Barang (ATK) F-RUT-0204 ke BAAK FEB, LPBM, BAAK FTIK, Prodi FTIK, dll. (Sep 2023 dan Feb 2024)
 * - Buku Form Distribusi Peralatan Listrik (Okt 2025 sampai Jun 2026)
 * - Pengajuan Pengadaan Barang Logistik Satpam dan Petugas Kebersihan (Oktober 2025)
 *
 * Aman dijalankan berulang: kategori/barang yang sudah ada dipakai ulang, dan dokumen contoh
 * hanya dibuat sekali (ditandai catatan "Contoh dari formulir kertas").
 *
 * Jalankan: npm run db:seed-distribusi   (setelah npm run db:push)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SAMPLE_NOTE = 'Contoh dari formulir kertas';
const WIB = (date, time = '09:00') => new Date(`${date}T${time}:00+07:00`);

// 1. Jenis stok kategori lama ditebak dari namanya.
const GROUP_RULES = [
  { group: 'LISTRIK', pattern: /listrik|elektronik|lampu|kabel|komputer|\bit\b/i },
  { group: 'LOGISTIK', pattern: /logistik|kebersihan|sanitasi|konsumsi|vitamin|satpam|packing/i },
];

const CATEGORIES = {
  listrik: { name: 'Elektronik', group: 'LISTRIK', description: 'Lampu, bohlam, starter, dan perlengkapan instalasi listrik gedung.' },
  vitamin: { name: 'Vitamin & Kesehatan', group: 'LOGISTIK', description: 'Vitamin untuk petugas CS, satpam, dan stok.' },
  satpam: { name: 'Logistik Satpam', group: 'LOGISTIK', description: 'Konsumsi pos satpam: mie, teh, susu, gula, kopi.' },
  bersih: { name: 'Kebersihan & Sanitasi', group: 'LOGISTIK', description: 'Perlengkapan petugas kebersihan.' },
  kertas: { name: 'Kebutuhan Kertas & Cetak', group: 'ATK', description: 'Kertas, amplop, map, dan business file.' },
  atk: { name: 'Alat Tulis Kantor (ATK)', group: 'ATK', description: 'Pena, pensil, isolasi, klip, dan perlengkapan tulis.' },
};

// [kunci, nama, kategori, satuan, stok minimum]
const PRODUCTS = [
  // Peralatan listrik
  ['led12', 'Lampu LED 12 Watt', 'listrik', 'pcs', 5],
  ['led18', 'Lampu LED 18 Watt', 'listrik', 'pcs', 3],
  ['tl16', 'Lampu TL LED 16 Watt', 'listrik', 'pcs', 3],
  ['tl18', 'Lampu TL LED 18 Watt', 'listrik', 'pcs', 3],
  ['tl12', 'Lampu TL 12 Watt', 'listrik', 'pcs', 2],
  ['panjang20', 'Lampu Panjang 20 Watt', 'listrik', 'pcs', 3],
  ['bohlam12', 'Bohlam LED 12 Watt', 'listrik', 'pcs', 3],
  ['bohlam32', 'Bohlam LED 32 Watt', 'listrik', 'pcs', 2],
  ['starter', 'Starter Lampu TL', 'listrik', 'pcs', 3],
  // Logistik (Pengajuan Pengadaan Oktober 2025)
  ['becomc', 'Becom-C (Vitamin C)', 'vitamin', 'tablet', 50],
  ['cdr', 'CDR (Vitamin & Mineral)', 'vitamin', 'kotak', 3],
  ['tolakangin', 'Tolak Angin', 'vitamin', 'kotak', 1],
  ['susuberuang', 'Susu Beruang', 'vitamin', 'krat', 1],
  ['mie', 'Mie Indomie Rebus', 'satpam', 'dus', 1],
  ['tehkotak', 'Teh Kotak Sari Wangi', 'satpam', 'kotak', 1],
  ['sususachet', 'Susu Sachet Bendera', 'satpam', 'pack', 5],
  ['gula', 'Gula Putih', 'satpam', 'kg', 2],
  ['kopi', 'Kopi Jempol 0,5 Ons', 'satpam', 'pack', 1],
  ['carbol', 'Pengharum Kamar Mandi SOS Carbol 800gr', 'bersih', 'dus', 1],
  ['sabunpiring', 'Sabun Cuci Piring HGNS Lime', 'bersih', 'drigen', 1],
  ['sabuntangan', 'Sabun Cuci Tangan HGNS Strawberry', 'bersih', 'drigen', 1],
  ['sabuncolek', 'Sabun Colek Wings 1000 Biru', 'bersih', 'dus', 1],
  ['ijoijo', 'Spons Ijo-Ijo Scotch Brite', 'bersih', 'pcs', 5],
  ['pel', 'Pel Lantai Clean Matic', 'bersih', 'pcs', 2],
  ['pelkuning', 'Pel Kuning Clean Matic', 'bersih', 'pcs', 1],
  ['clingrefil', 'Pembersih Kaca Cling Refill', 'bersih', 'pcs', 2],
  ['clingbotol', 'Pembersih Kaca Cling Botol', 'bersih', 'pcs', 1],
  ['kapurbarus', 'Kapur Barus Dahlia', 'bersih', 'pcs', 2],
  ['glade', 'Pewangi Ruangan Glade', 'bersih', 'kaleng', 5],
  ['baygon', 'Baygon Semprot 600 ml', 'bersih', 'kaleng', 2],
  ['tissue', 'Tissue Nice Refill Besar', 'bersih', 'ball', 2],
  ['tissuemobil', 'Tissue Mobil Nice Refill Kecil', 'bersih', 'ball', 2],
  ['sapu', 'Sapu Lantai Nagata', 'bersih', 'pcs', 2],
  ['sapulidi', 'Sapu Lidi', 'bersih', 'pcs', 2],
  ['plastik', 'Plastik Sampah 100 x 120', 'bersih', 'pack', 10],
  ['pewangikarpet', 'Pewangi Karpet Ginger', 'bersih', 'pcs', 3],
  ['keset', 'Keset Welcome', 'bersih', 'pcs', 1],
  ['skrap', 'Skrap Lantai', 'bersih', 'pcs', 1],
  ['karetkaca', 'Alat Karet Pembersih Kaca', 'bersih', 'pcs', 1],
  // ATK (Form Distribusi Barang F-RUT-0204)
  ['a4', 'Kertas A4 75 Gr', 'kertas', 'rim', 20],
  ['f475', 'Kertas F4 75 Gr', 'kertas', 'rim', 10],
  ['f460', 'Kertas F4 60 Gr', 'kertas', 'rim', 3],
  ['kupu', 'Kertas Kupu-Kupu', 'kertas', 'rim', 1],
  ['amplopfeb', 'Amplop KOP FEB', 'kertas', 'kotak', 1],
  ['amplop104', 'Amplop Paperline 104 PPS', 'kertas', 'kotak', 1],
  ['amplop90', 'Amplop Paperline 90 PPS', 'kertas', 'kotak', 1],
  ['mappink', 'Map Kertas Kabita Pink', 'kertas', 'pack', 2],
  ['maphijau', 'Map Kertas Biola Hijau', 'kertas', 'pack', 2],
  ['bfile', 'Business File Orange', 'kertas', 'pack', 3],
  ['carryfile', 'Carry File', 'kertas', 'pcs', 2],
  ['odner', 'Odner', 'kertas', 'pcs', 2],
  ['sticky', 'Sticky Notes', 'atk', 'pcs', 5],
  ['signhere', 'Sign Here TTD', 'atk', 'pcs', 2],
  ['ae7', 'Pena Standar AE7', 'atk', 'pcs', 12],
  ['tizzo', 'Pena Tizzo', 'atk', 'pcs', 3],
  ['parker', 'Pena Parker', 'atk', 'pcs', 2],
  ['standing', 'Pena Standing', 'atk', 'pcs', 2],
  ['refhitam', 'Refill Pena Hitam Joyko', 'atk', 'pcs', 12],
  ['refbiru', 'Refill Pena Biru Joyko', 'atk', 'pcs', 6],
  ['pensil', 'Pensil 2B Faber Castell', 'atk', 'pcs', 6],
  ['isolasi', 'Isolasi Handeru 1/2', 'atk', 'pcs', 5],
  ['tapecutter', 'Tape Cutter Isolasi', 'atk', 'pcs', 1],
  ['lakban', 'Lakban Handeru Bening', 'atk', 'pcs', 4],
  ['lakbanbesar', 'Lakban Handeru Besar', 'atk', 'pcs', 2],
  ['tipex', 'Tipe-X', 'atk', 'pcs', 4],
  ['raut', 'Peruncing Pensil', 'atk', 'pcs', 3],
  ['tintastempel', 'Tinta Stempel Biru', 'atk', 'pcs', 3],
  ['paperclip', 'Paper Clip Kenko', 'atk', 'kotak', 10],
  ['binderkecil', 'Binder Clip Kecil', 'atk', 'kotak', 4],
  ['bindersedang', 'Binder Clip Kenko Sedang', 'atk', 'kotak', 2],
  ['binder155', 'Binder Clip No. 155', 'atk', 'kotak', 2],
  ['binder260', 'Binder Clip No. 260', 'atk', 'kotak', 2],
  ['isicutter', 'Isi Cutter Kenko L150', 'atk', 'tube', 3],
  ['cutter', 'Cutter', 'atk', 'pcs', 2],
  ['gunting', 'Gunting Kenko', 'atk', 'pcs', 2],
  ['penghapus', 'Penghapus', 'atk', 'pcs', 4],
  ['stabilo', 'Stabilo Boss', 'atk', 'pcs', 4],
  ['isistapler', 'Isi Stapler Kenko', 'atk', 'kotak', 4],
  ['stapler', 'Stapler', 'atk', 'pcs', 2],
  ['penggaris', 'Penggaris Besi', 'atk', 'pcs', 1],
  ['dtkecil', 'Double Tape Kecil', 'atk', 'pcs', 3],
  ['dtbesar', 'Double Tape Besar', 'atk', 'pcs', 2],
  ['spidol', 'Spidol Snowman', 'atk', 'pcs', 6],
  ['lemstick', 'Lem Stick Kenko', 'atk', 'pcs', 2],
  ['epsonhitam', 'Refill Tinta Epson Hitam', 'atk', 'pcs', 2],
  ['epsonbiru', 'Refill Tinta Epson Biru', 'atk', 'pcs', 1],
  ['epsonmerah', 'Refill Tinta Epson Merah', 'atk', 'pcs', 1],
  ['epsonkuning', 'Refill Tinta Epson Kuning', 'atk', 'pcs', 1],
  ['abca2', 'Baterai ABC A2', 'atk', 'kotak', 1],
  ['abcbesar', 'Baterai ABC Besar', 'atk', 'pcs', 4],
];

// Pengajuan Pengadaan Barang Logistik, Oktober 2025: [barang, stok sebelum, jumlah beli, supplier, harga satuan]
const PROCUREMENT = [
  ['becomc', 1, 500, 'Apotik Harapan', 2170], ['cdr', 0, 18, 'Apotik Harapan', 76000], ['tolakangin', 0, 1, 'Apotik Harapan', 48000],
  ['susuberuang', 1, 7, 'Puti Minang Grosir', 285000], ['mie', 1, 4, 'Puti Minang Grosir', 117000], ['tehkotak', 2, 4, 'Puti Minang Grosir', 6000],
  ['sususachet', 0, 35, 'Puti Minang Grosir', 8000], ['gula', 1, 10, 'Puti Minang Grosir', 17000], ['kopi', 1, 5, 'Puti Minang Grosir', 67500],
  ['carbol', 0, 3, 'Alfamart', 142800], ['sabunpiring', 5, 2, 'HGNS', 72500], ['sabuntangan', 0, 3, 'HGNS', 48500],
  ['sabuncolek', 0, 2, 'Puti Minang Grosir', 60000], ['ijoijo', 0, 20, 'Chandra Departemen Store', 8500], ['pel', 0, 5, 'Chandra Departemen Store', 102000],
  ['pelkuning', 0, 2, 'Chandra Departemen Store', 120000], ['clingrefil', 1, 7, 'Chandra Departemen Store', 3600], ['clingbotol', 0, 2, 'Chandra Departemen Store', 7500],
  ['kapurbarus', 0, 8, 'Chandra Departemen Store', 24000], ['glade', 5, 20, 'Chandra Departemen Store', 33900], ['baygon', 0, 5, 'Chandra Departemen Store', 34500],
  ['tissue', 3, 6, 'Chandra Departemen Store', 40500], ['tissuemobil', 0, 6, 'Chandra Departemen Store', 20900], ['sapu', 0, 8, 'Toko Kelontongan', 25000],
  ['sapulidi', 0, 7, 'Toko Kelontongan', 10000], ['plastik', 3, 40, 'Toko Kelontongan', 22000], ['pewangikarpet', 5, 15, 'Toko Kelontongan', 31000],
  ['keset', 0, 5, 'Toko Kelontongan', 25000], ['skrap', 0, 4, 'Toko Kelontongan', 10000], ['karetkaca', 0, 4, 'Toko Kelontongan', 15000],
];

const SRI = 'Sri Wahyuni, S.Kom.';
// Dokumen distribusi: [jenis, tanggal, kepada/ruang, penerima, tempat simpan, yang menyerahkan/petugas, [[barang, jumlah], ...], catatan]
const DISTRIBUTIONS = [
  // ATK, 1 September 2023
  ['ATK', '2023-09-01', 'Tata Usaha BAAK FEB', 'TU BAAK FEB', 'BAAK FEB', SRI, [['a4', 6], ['f475', 2], ['f460', 5], ['ae7', 6], ['refhitam', 12], ['pensil', 4], ['isolasi', 3], ['tipex', 2], ['raut', 2], ['tintastempel', 4], ['paperclip', 1], ['isicutter', 1], ['penghapus', 4], ['sticky', 1], ['stabilo', 4], ['isistapler', 1], ['penggaris', 1], ['stapler', 3], ['dtkecil', 2], ['amplopfeb', 2]], 'Paper Clip Kenko belum ada saat serah terima'],
  ['ATK', '2023-09-01', 'Tata Usaha Divisi LPBM', 'TU LPBM', 'LPBM', SRI, [['a4', 10], ['f475', 10], ['lemstick', 2], ['lakban', 2], ['isicutter', 2], ['paperclip', 3], ['ae7', 3], ['binderkecil', 3]]],
  ['ATK', '2023-09-01', 'Tata Usaha BAAK FTIK', 'TU BAAK FTIK', 'BAAK FTIK', SRI, [['a4', 40], ['f475', 9], ['ae7', 7], ['pensil', 4], ['isolasi', 2], ['standing', 3], ['raut', 3], ['lakban', 2], ['paperclip', 1], ['carryfile', 2], ['penghapus', 3], ['binder155', 1], ['stabilo', 2], ['gunting', 1], ['cutter', 1]]],
  ['ATK', '2023-09-01', 'Tata Usaha Prodi FTIK', 'TU Prodi FTIK', 'Prodi FTIK', SRI, [['a4', 10], ['f475', 4], ['paperclip', 4], ['binderkecil', 1], ['spidol', 10], ['stabilo', 3], ['tipex', 4], ['isistapler', 1]]],
  ['ATK', '2023-09-01', 'Tata Usaha Kemahasiswaan', 'TU Kemahasiswaan', 'Kemahasiswaan', SRI, [['a4', 5], ['mappink', 3], ['paperclip', 6], ['refhitam', 2], ['tizzo', 2], ['amplop104', 1], ['amplop90', 1], ['cutter', 1], ['isicutter', 1]]],
  ['ATK', '2023-09-01', 'Tata Usaha LPM & LPPM', 'Siska Maryati, S.Kom.', 'LPM & LPPM', SRI, [['a4', 5], ['paperclip', 3], ['signhere', 2], ['mappink', 1], ['sticky', 2]]],
  ['ATK', '2023-09-01', 'Tata Usaha Perpustakaan', 'Staff Perpustakaan', 'Perpustakaan', SRI, [['a4', 3], ['f475', 1], ['isistapler', 3], ['abca2', 1], ['odner', 4], ['lakban', 4], ['dtkecil', 2], ['kupu', 1]]],
  ['ATK', '2023-09-01', 'Tata Usaha BAAK FSIP', 'BAAK FSIP', 'BAAK FSIP', SRI, [['a4', 10], ['f475', 10], ['binderkecil', 5], ['bindersedang', 4], ['paperclip', 10], ['isolasi', 5], ['lakban', 2], ['bfile', 2], ['maphijau', 3], ['refhitam', 4], ['refbiru', 4], ['epsonhitam', 4], ['epsonbiru', 2], ['epsonmerah', 2], ['epsonkuning', 2], ['tintastempel', 5]]],
  ['ATK', '2023-09-01', 'Tata Usaha Informasi', 'TU Informasi', 'Informasi', SRI, [['a4', 8], ['f475', 5], ['tapecutter', 1], ['stapler', 3], ['isistapler', 1], ['paperclip', 5], ['abcbesar', 10], ['abca2', 1], ['isolasi', 2], ['lakban', 2], ['gunting', 2], ['ae7', 12]]],
  ['ATK', '2024-02-06', 'Tata Usaha LPPM/LPM', 'Rido Febryansyah', 'LPPM/LPM', SRI, [['a4', 8], ['paperclip', 3], ['refhitam', 2], ['mappink', 1], ['sticky', 2]]],
  ['ATK', '2024-02-06', 'Tata Usaha LPBM/PKL', 'Nurgiyanti', 'LPBM/PKL', SRI, [['a4', 17], ['f475', 8], ['spidol', 2], ['lakbanbesar', 2], ['isicutter', 3], ['paperclip', 3], ['ae7', 10], ['binder155', 3], ['binder260', 2], ['dtbesar', 2], ['dtkecil', 2], ['bfile', 10], ['gunting', 1], ['parker', 2], ['refbiru', 6]]],
  // Logistik, setelah pengadaan Oktober 2025 (keperluan sesuai kolom "Keperluan" pada pengajuan)
  ['LOGISTIK', '2025-10-02', 'Pos Satpam Utama', 'Koordinator Satpam', 'Pos Satpam', SRI, [['mie', 2], ['tehkotak', 2], ['sususachet', 15], ['gula', 5], ['kopi', 3]], 'Logistik satpam bulan Oktober'],
  ['LOGISTIK', '2025-10-02', 'Petugas CS dan Satpam', 'Koordinator CS', 'Gudang Umum', SRI, [['becomc', 250], ['cdr', 8], ['susuberuang', 3]], 'Vitamin CS dan satpam'],
  ['LOGISTIK', '2025-10-03', 'Petugas Kebersihan Gedung A', 'Koordinator Kebersihan', 'Gudang Kebersihan Gd. A', SRI, [['carbol', 1], ['sabunpiring', 1], ['sabuntangan', 1], ['ijoijo', 8], ['pel', 2], ['clingrefil', 3], ['glade', 8], ['tissue', 2], ['plastik', 15], ['sapu', 3]], 'Perlengkapan petugas kebersihan'],
  ['LOGISTIK', '2025-10-03', 'Petugas Kebersihan Gedung D', 'Koordinator Kebersihan', 'Gudang Kebersihan Gd. D', SRI, [['sabuntangan', 1], ['ijoijo', 6], ['pel', 2], ['kapurbarus', 4], ['glade', 6], ['baygon', 2], ['plastik', 10], ['sapulidi', 3], ['pewangikarpet', 5]]],
  ['LOGISTIK', '2025-10-06', 'Tata Usaha Informasi', 'TU Informasi', 'Informasi', SRI, [['baygon', 1], ['kapurbarus', 1], ['sabuntangan', 1]]],
];

// Buku Form Distribusi Peralatan Listrik: [tanggal, barang, ruang, banyaknya, nama petugas]
const LISTRIK_LOG = [
  ['2025-10-14', 'led12', 'Informasi', 3, 'Riki'],
  ['2026-05-02', 'led12', 'Toilet Lt. 3 Gd. B', 1, 'Ulki'],
  ['2026-05-02', 'led12', 'Ruang Pengajaran', 2, 'Aswin'],
  ['2026-05-07', 'panjang20', 'Perpustakaan Lt. 1', 3, 'Asun'],
  ['2026-05-11', 'led12', 'Kemahasiswaan', 1, 'Asrori'],
  ['2026-05-13', 'led12', 'Perpustakaan', 3, 'Ulki'],
  ['2026-05-15', 'led12', 'Toilet Lt. 3 Gd. A', 1, 'Ulki'],
  ['2026-05-18', 'led18', 'Perpustakaan', 1, 'Asun'],
  ['2026-05-18', 'led12', 'Perpustakaan', 1, 'Ulki'],
  ['2026-05-20', 'panjang20', 'Perpustakaan', 2, 'Asun'],
  ['2026-05-25', 'tl18', 'Keuangan', 1, 'Asun'],
  ['2026-05-25', 'led12', 'Toilet Lt. 2 Gd. A', 1, 'Ulki'],
  ['2026-06-01', 'starter', 'Lorong KSP', 1, 'Hendri'],
  ['2026-06-01', 'tl18', 'Lorong Gd. A', 1, 'Riki'],
  ['2026-06-02', 'tl16', 'Lorong Gd. A', 1, 'Riki'],
  ['2026-06-02', 'led12', 'GYM', 2, 'Riki'],
  ['2026-06-02', 'led12', 'Lt. 1 Perkantoran', 1, 'Asun'],
  ['2026-06-02', 'led12', 'WC Gd. D', 1, 'Asun'],
  ['2026-06-02', 'tl18', 'Pustik A', 2, 'Riki'],
  ['2026-06-03', 'tl18', 'Pustik A', 1, 'Riki'],
  ['2026-06-03', 'bohlam32', 'Info A', 1, 'Riki'],
  ['2026-06-09', 'bohlam12', 'Info A', 1, 'Riki'],
  ['2026-06-09', 'tl12', 'Lt. 2 Gd. D', 1, 'Ulki'],
  ['2026-06-09', 'led12', 'Lt. 1 Perpustakaan', 3, 'Ulki'],
  ['2026-06-09', 'panjang20', 'Lt. 2 Perkantoran', 2, 'Asun'],
];

const PREFIX = { LISTRIK: 'LST', LOGISTIK: 'LOG', ATK: 'ATK' };

function skuPrefix(categoryName) {
  return (
    categoryName.normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'KATEGORI'
  );
}

async function nextSku(categoryName) {
  const prefix = skuPrefix(categoryName);
  const rows = await prisma.product.findMany({ where: { sku: { startsWith: `${prefix}-` } }, select: { sku: true } });
  const last = rows.reduce((max, row) => {
    const match = row.sku.match(/-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(last + 1).padStart(3, '0')}`;
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true }, orderBy: { createdAt: 'asc' } });

  // 1. Petakan jenis stok kategori yang sudah ada.
  for (const category of await prisma.category.findMany()) {
    const rule = GROUP_RULES.find((r) => r.pattern.test(category.name));
    const group = rule ? rule.group : 'ATK';
    if (category.stockGroup !== group) {
      await prisma.category.update({ where: { id: category.id }, data: { stockGroup: group } });
      console.log(`Kategori "${category.name}" -> ${group}`);
    }
  }

  const alreadySeeded = await prisma.distribution.count({ where: { notes: { startsWith: SAMPLE_NOTE } } });
  if (alreadySeeded > 0) {
    console.log(`Dokumen contoh sudah ada (${alreadySeeded}). Pemetaan kategori selesai, data contoh tidak dibuat ulang.`);
    await seedTemplates();
    return;
  }

  // 2. Kategori contoh.
  const categoryIds = {};
  for (const [key, def] of Object.entries(CATEGORIES)) {
    const existing = await prisma.category.findUnique({ where: { name: def.name } });
    const category = existing
      ? await prisma.category.update({ where: { id: existing.id }, data: { stockGroup: def.group } })
      : await prisma.category.create({ data: { name: def.name, description: def.description, stockGroup: def.group } });
    categoryIds[key] = category;
  }

  // 3. Hitung kebutuhan setiap barang agar saldo awal cukup untuk semua dokumen contoh.
  const need = {};
  const add = (key, qty) => (need[key] = (need[key] || 0) + qty);
  for (const doc of DISTRIBUTIONS) for (const [key, qty] of doc[6]) add(key, qty);
  for (const row of LISTRIK_LOG) add(row[1], row[3]);
  const procurement = Object.fromEntries(PROCUREMENT.map((row) => [row[0], row]));

  // 4. Barang + saldo awal.
  const products = {};
  for (const [key, name, catKey, unit, minimumStock] of PRODUCTS) {
    const category = categoryIds[catKey];
    let product = await prisma.product.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    if (!product) {
      product = await prisma.product.create({
        data: { sku: await nextSku(category.name), name, unit, minimumStock, categoryId: category.id, currentStock: 0 },
      });
    }
    products[key] = product;

    const proc = procurement[key];
    const entries = [];
    if (proc) {
      // Logistik: stok sebelum pengadaan (kolom Keterangan) lalu pembelian Oktober 2025.
      if (proc[1] > 0) entries.push({ qty: proc[1], date: WIB('2025-09-01'), notes: 'Saldo awal (kolom Keterangan Stok pada pengajuan pengadaan)' });
      entries.push({
        qty: proc[2],
        date: WIB('2025-09-29', '10:00'),
        notes: `Pengadaan Oktober 2025 dari ${proc[3]} @ Rp ${proc[4].toLocaleString('id-ID')}`,
      });
    } else {
      const required = need[key] || 0;
      const buffer = Math.max(minimumStock + 2, Math.ceil(required * 0.25));
      const isListrik = catKey === 'listrik';
      entries.push({
        qty: required + buffer,
        date: isListrik ? WIB('2025-10-01') : WIB('2023-08-31'),
        notes: isListrik ? 'Saldo awal peralatan listrik' : 'Saldo awal ATK sebelum distribusi September 2023',
      });
    }

    for (const entry of entries) {
      const fresh = await prisma.product.update({ where: { id: product.id }, data: { currentStock: { increment: entry.qty } } });
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          actorUserId: admin?.id ?? null,
          type: 'IN',
          quantity: entry.qty,
          stockBefore: fresh.currentStock - entry.qty,
          stockAfter: fresh.currentStock,
          source: 'SYSTEM',
          notes: `${entry.notes}. ${SAMPLE_NOTE}`,
          createdAt: entry.date,
        },
      });
    }
  }

  // 5. Dokumen distribusi, diurutkan menurut tanggal.
  const docs = [
    ...DISTRIBUTIONS.map(([group, date, recipient, receiver, storage, handover, items, notes]) => ({ group, date, recipient, receiver, storage, handover, items, notes })),
    ...LISTRIK_LOG.map(([date, key, room, qty, person]) => ({ group: 'LISTRIK', date, recipient: room, receiver: null, storage: null, handover: person, items: [[key, qty]], notes: null })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const counters = {};
  for (const doc of docs) {
    const monthKey = doc.date.slice(0, 7).replace('-', '');
    const prefix = `${PREFIX[doc.group]}-${monthKey}-`;
    counters[prefix] = (counters[prefix] || 0) + 1;
    const number = `${prefix}${String(counters[prefix]).padStart(3, '0')}`;
    const at = WIB(doc.date, '10:00');

    await prisma.$transaction(async (tx) => {
      const distribution = await tx.distribution.create({
        data: {
          number,
          stockGroup: doc.group,
          recipientUnit: doc.recipient,
          orderNumber: null,
          distributedAt: at,
          storageLocation: doc.storage,
          receiverName: doc.receiver,
          handoverName: doc.handover,
          notes: doc.notes ? `${SAMPLE_NOTE}. ${doc.notes}` : SAMPLE_NOTE,
          creatorUserId: admin?.id ?? null,
          createdAt: at,
        },
      });
      for (const [key, qty] of doc.items) {
        const product = products[key];
        if (!product) throw new Error(`Barang contoh "${key}" tidak terdaftar.`);
        const updated = await tx.product.update({ where: { id: product.id }, data: { currentStock: { decrement: qty } } });
        if (updated.currentStock < 0) throw new Error(`Stok contoh ${product.name} minus.`);
        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            actorUserId: admin?.id ?? null,
            type: 'OUT',
            quantity: qty,
            stockBefore: updated.currentStock + qty,
            stockAfter: updated.currentStock,
            source: 'WEB',
            referenceId: distribution.id,
            notes: `Distribusi ${number} ke ${doc.recipient}`,
            createdAt: at,
          },
        });
        await tx.distributionItem.create({
          data: { distributionId: distribution.id, productId: product.id, quantity: qty, unit: product.unit, movementId: movement.id },
        });
      }
    }, { timeout: 60_000, maxWait: 10_000 });
    console.log(`${number}  ${doc.recipient} (${doc.items.length} barang)`);
  }

  console.log(`Selesai: ${PRODUCTS.length} barang contoh, ${docs.length} dokumen distribusi.`);
  await seedTemplates();
}

/**
 * Paket distribusi per unit dari formulir kertas (BAAK FSIP, LPPM, Prodi FTIK, dst.).
 * Nama paket = tempat penyimpanan pada form. Paket yang sudah ada tidak ditimpa,
 * jadi perubahan yang dibuat admin di web tetap aman.
 */
async function seedTemplates() {
  const productIdByKey = {};
  for (const [key, name] of PRODUCTS) {
    const product = await prisma.product.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
    if (product) productIdByKey[key] = product.id;
  }

  let created = 0;
  for (const [group, , recipient, receiver, storage, , items] of DISTRIBUTIONS) {
    const name = storage;
    const exists = await prisma.distributionTemplate.findUnique({ where: { stockGroup_name: { stockGroup: group, name } } });
    if (exists) continue;
    const rows = items.filter(([key]) => productIdByKey[key]);
    if (rows.length === 0) continue;
    await prisma.distributionTemplate.create({
      data: {
        stockGroup: group,
        name,
        recipientUnit: recipient,
        storageLocation: storage,
        receiverName: receiver,
        items: { create: rows.map(([key, quantity], index) => ({ productId: productIdByKey[key], quantity, sortOrder: index })) },
      },
    });
    created += 1;
    console.log(`Paket ${group} "${name}" (${rows.length} barang)`);
  }
  console.log(`Paket distribusi baru: ${created}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
