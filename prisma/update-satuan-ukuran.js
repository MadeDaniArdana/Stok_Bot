// Mengubah satuan barang kebersihan agar menyertakan ukuran isi, mis. "botol 330ml" / "botol 800gr".
// Jalankan cek dulu (tanpa mengubah data):   npm run db:satuan-ukuran
// Terapkan perubahan:                        npm run db:satuan-ukuran -- --apply
//
// Aman untuk jumlah stok: hanya satuan dasar per buah (pcs/botol/buah/bh/pouch) yang diganti namanya,
// sehingga angka stok & riwayat tidak berubah arti. Barang yang satuannya kemasan (dus/drigen) tanpa
// konversi dilewati; atur lewat menu Edit Barang > satuan kecil (mis. 1 dus = 12 botol 800gr).
const { PrismaClient } = require('@prisma/client');

const APPLY = process.argv.includes('--apply');
const PER_PIECE_UNITS = new Set(['pcs', 'botol', 'buah', 'bh', 'pouch']);

/** Ambil ukuran isi dari nama barang, mis. "Carbol 800gr" -> "800gr", "Sunlight 330 ml" -> "330ml". */
function sizeFromName(name) {
  const match = name.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(ml|liter|l|gr|gram|g|kg)\b/);
  return match ? `${match[1]}${match[2]}` : null;
}

const RULES = [
  { label: 'Sabun Cuci Piring Sunlight', test: (n) => n.includes('sunlight'), size: '330ml' },
  { label: 'Pengharum Kamar Mandi SOS Carbol', test: (n) => n.includes('carbol'), size: '800gr' },
  // Ukuran sabun cuci tangan diambil dari nama barang bila ada; jika tidak, pakai ukuran yang sama dengan Sunlight.
  { label: 'Sabun Cuci Tangan', test: (n) => n.includes('sabun cuci tangan'), size: null, fallbackSize: '330ml' },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    const products = await prisma.product.findMany({
      select: { id: true, sku: true, name: true, unit: true, packUnit: true, packSize: true, currentStock: true },
      orderBy: { name: 'asc' },
    });

    let changed = 0;
    for (const rule of RULES) {
      const matches = products.filter((p) => rule.test(p.name.toLowerCase()));
      if (matches.length === 0) {
        console.log(`- ${rule.label}: barang tidak ditemukan.`);
        continue;
      }
      for (const p of matches) {
        const size = rule.size || sizeFromName(p.name) || rule.fallbackSize;
        const newUnit = `botol ${size}`;
        const tag = `${p.name} [${p.sku}]`;
        if (p.unit === newUnit) {
          console.log(`= ${tag}: sudah "${newUnit}".`);
          continue;
        }
        if (!PER_PIECE_UNITS.has(p.unit)) {
          console.log(
            `! ${tag}: satuan "${p.unit}" adalah kemasan, dilewati. ` +
              `Atur lewat Edit Barang > satuan kecil "${newUnit}" dengan isi per ${p.unit}.`
          );
          continue;
        }
        const pack = p.packUnit && p.packSize ? ` (1 ${p.packUnit} = ${p.packSize} ${newUnit})` : '';
        console.log(`${APPLY ? '✓' : '→'} ${tag}: "${p.unit}" -> "${newUnit}"${pack}, stok ${p.currentStock}`);
        if (APPLY) await prisma.product.update({ where: { id: p.id }, data: { unit: newUnit } });
        changed += 1;
      }
    }

    console.log(
      APPLY
        ? `\nSelesai: ${changed} barang diperbarui.`
        : `\n${changed} barang akan diubah. Jalankan dengan --apply untuk menerapkan.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
