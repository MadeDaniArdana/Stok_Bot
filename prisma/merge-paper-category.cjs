const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const moved = await prisma.$transaction(async (tx) => {
    const source = await tx.category.findUnique({ where: { name: 'Kebutuhan Kertas & Cetak' } });
    if (!source) return 0;
    const destination = await tx.category.findUnique({ where: { name: 'Alat Tulis Kantor (ATK)' } });
    if (!destination || destination.stockGroup !== 'ATK') throw new Error('Kategori tujuan ATK tidak ditemukan.');
    const result = await tx.product.updateMany({
      where: { categoryId: source.id },
      data: { categoryId: destination.id },
    });
    await tx.category.delete({ where: { id: source.id } });
    return result.count;
  }, { isolationLevel: 'Serializable' });
  console.log(`${moved} barang dipindahkan ke Alat Tulis Kantor (ATK).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
