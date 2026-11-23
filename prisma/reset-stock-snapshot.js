// Kosongkan cache sisa stok akhir bulan (StockMonthlySnapshot).
// Jalankan setelah mengoreksi riwayat stok langsung di database; laporan akan menghitung ulang otomatis.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma
  .$executeRawUnsafe('DELETE FROM "StockMonthlySnapshot"')
  .then((n) => console.log(`Cache laporan bulanan dikosongkan (${n} baris). Akan dihitung ulang saat laporan dibuka.`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
