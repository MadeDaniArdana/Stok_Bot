const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding StockFlow database...');

  // 1. Clean up existing data
  await prisma.notification.deleteMany();
  await prisma.stockRequest.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.telegramUpdate.deleteMany();
  await prisma.telegramUser.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // 2. Users
  const admin = await prisma.user.create({
    data: {
      id: 'u-admin-01',
      name: 'Budi Pratama (Admin)',
      email: 'admin@stockflow.com',
      role: 'ADMIN',
      isActive: true,
    },
  });

  const userSiti = await prisma.user.create({
    data: {
      id: 'u-user-01',
      name: 'Siti Rahma',
      email: 'siti@stockflow.com',
      role: 'USER',
      isActive: true,
      telegram: {
        create: {
          telegramUserId: '78291044',
          telegramChatId: '78291044',
          username: 'sitirahma_ops',
          isActive: true,
        },
      },
    },
  });

  const userAhmad = await prisma.user.create({
    data: {
      id: 'u-user-02',
      name: 'Ahmad Fauzi',
      email: 'ahmad@stockflow.com',
      role: 'USER',
      isActive: true,
      telegram: {
        create: {
          telegramUserId: '91823746',
          telegramChatId: '91823746',
          username: 'ahmadfauzi_dev',
          isActive: true,
        },
      },
    },
  });

  const userDewi = await prisma.user.create({
    data: {
      id: 'u-user-03',
      name: 'Dewi Lestari',
      email: 'dewi@stockflow.com',
      role: 'USER',
      isActive: true,
    },
  });

  // 3. Categories
  const catATK = await prisma.category.create({
    data: {
      id: 'cat-atk',
      name: 'Alat Tulis Kantor (ATK)',
      description: 'Pulpen, spidol, gunting, stapler, dan perlengkapan tulis kantor sehari-hari.',
    },
  });

  const catPaper = await prisma.category.create({
    data: {
      id: 'cat-paper',
      name: 'Kebutuhan Kertas & Cetak',
      description: 'Kertas HVS berbagai ukuran, amplop, cover buku, dan kertas cetak foto.',
    },
  });

  const catIT = await prisma.category.create({
    data: {
      id: 'cat-it',
      name: 'Perlengkapan Komputer & IT',
      description: 'Toner printer, kabel jaringan, mouse kantor, dan periferal komputer.',
    },
  });

  const catClean = await prisma.category.create({
    data: {
      id: 'cat-clean',
      name: 'Kebersihan & Sanitasi',
      description: 'Sabun cuci tangan, tisu toilet, pembersih lantai, dan hand sanitizer.',
    },
  });

  const catPack = await prisma.category.create({
    data: {
      id: 'cat-pack',
      name: 'Logistik & Packing',
      description: 'Lakban, bubble wrap, tali rafia, dan kardus packing barang keluar.',
    },
  });

  // 4. Products
  const prodA4 = await prisma.product.create({
    data: {
      id: 'prod-01',
      sku: 'PAP-A4-01',
      name: 'Kertas HVS A4 80gr PaperOne',
      description: 'Kertas HVS putih ukuran A4 80 GSM isi 500 lembar per rim.',
      categoryId: catPaper.id,
      unit: 'rim',
      currentStock: 65,
      minimumStock: 20,
      isActive: true,
    },
  });

  const prodPen = await prisma.product.create({
    data: {
      id: 'prod-02',
      sku: 'PEN-GEL-01',
      name: 'Pulpen Gel Faster 0.5 Black',
      description: 'Pulpen gel hitam 0.5mm 1 pack isi 12 pcs.',
      categoryId: catATK.id,
      unit: 'box',
      currentStock: 12,
      minimumStock: 10,
      isActive: true,
    },
  });

  const prodMarker = await prisma.product.create({
    data: {
      id: 'prod-03',
      sku: 'MKR-WB-01',
      name: 'Spidol Whiteboard Snowman Hitam',
      description: 'Spidol papan tulis putih anti bocor warna hitam pekat.',
      categoryId: catATK.id,
      unit: 'pcs',
      currentStock: 8,
      minimumStock: 15, // Low stock!
      isActive: true,
    },
  });

  const prodToner = await prisma.product.create({
    data: {
      id: 'prod-04',
      sku: 'TNR-HP-85A',
      name: 'Toner HP LaserJet 85A (CE285A)',
      description: 'Cartridge toner original HP untuk printer HP LaserJet P1102.',
      categoryId: catIT.id,
      unit: 'unit',
      currentStock: 0,
      minimumStock: 3, // Out of stock!
      isActive: true,
    },
  });

  const prodTape = await prisma.product.create({
    data: {
      id: 'prod-05',
      sku: 'TAP-CL-02',
      name: 'Lakban Coklat Daimaru 2 Inch',
      description: 'Lakban perekat packing heavy duty warna coklat 48mm x 90 yard.',
      categoryId: catPack.id,
      unit: 'roll',
      currentStock: 42,
      minimumStock: 15,
      isActive: true,
    },
  });

  const prodStapler = await prisma.product.create({
    data: {
      id: 'prod-06',
      sku: 'STP-MAX-10',
      name: 'Stapler Max HD-10 Star',
      description: 'Stapler jepit ukuran no.10 tahan banting.',
      categoryId: catATK.id,
      unit: 'unit',
      currentStock: 18,
      minimumStock: 5,
      isActive: true,
    },
  });

  const prodLan = await prisma.product.create({
    data: {
      id: 'prod-07',
      sku: 'CAB-CAT6-5M',
      name: 'Kabel LAN UTP Belden Cat6 5M',
      description: 'Kabel patch cord gigabit RJ45 panjang 5 meter siap pakai.',
      categoryId: catIT.id,
      unit: 'pcs',
      currentStock: 4,
      minimumStock: 8, // Low stock!
      isActive: true,
    },
  });

  const prodSoap = await prisma.product.create({
    data: {
      id: 'prod-08',
      sku: 'CLN-SOAP-5L',
      name: 'Sabun Cuci Tangan Antibakterial 5 Liter',
      description: 'Cairan hand wash aroma apel kemasan jerigen 5 Liter.',
      categoryId: catClean.id,
      unit: 'jerigen',
      currentStock: 15,
      minimumStock: 5,
      isActive: true,
    },
  });

  // 5. Initial Movements
  const now = new Date();
  const d3Ago = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const d2Ago = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const d1Ago = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
  const h4Ago = new Date(Date.now() - 4 * 60 * 60 * 1000);

  // Kertas A4 initial & transactions
  await prisma.stockMovement.create({
    data: {
      productId: prodA4.id,
      actorUserId: admin.id,
      type: 'IN',
      quantity: 50,
      stockBefore: 0,
      stockAfter: 50,
      source: 'SYSTEM',
      notes: 'Saldo awal migrasi sistem persediaan',
      createdAt: d3Ago,
    },
  });

  await prisma.stockMovement.create({
    data: {
      productId: prodA4.id,
      actorUserId: admin.id,
      type: 'IN',
      quantity: 20,
      stockBefore: 50,
      stockAfter: 70,
      source: 'WEB',
      notes: 'Penerimaan PO #PO-2026-11-01 dari PT Sumber Jaya',
      createdAt: d2Ago,
    },
  });

  await prisma.stockMovement.create({
    data: {
      productId: prodA4.id,
      actorUserId: userSiti.id,
      type: 'OUT',
      quantity: 5,
      stockBefore: 70,
      stockAfter: 65,
      source: 'TELEGRAM',
      telegramUpdateId: 'tg-upd-1001',
      notes: 'Keperluan: Laporan rekapitulasi audit dan berkas tender',
      createdAt: h4Ago,
    },
  });

  // Marker transactions (Low Stock)
  await prisma.stockMovement.create({
    data: {
      productId: prodMarker.id,
      actorUserId: admin.id,
      type: 'IN',
      quantity: 15,
      stockBefore: 0,
      stockAfter: 15,
      source: 'SYSTEM',
      notes: 'Saldo awal gudang',
      createdAt: d3Ago,
    },
  });

  await prisma.stockMovement.create({
    data: {
      productId: prodMarker.id,
      actorUserId: userAhmad.id,
      type: 'OUT',
      quantity: 7,
      stockBefore: 15,
      stockAfter: 8,
      source: 'TELEGRAM',
      telegramUpdateId: 'tg-upd-1002',
      notes: 'Keperluan: Pembagian perlengkapan ruang meeting lantai 2 dan 3',
      createdAt: d1Ago,
    },
  });

  // Toner transactions (Out of Stock)
  await prisma.stockMovement.create({
    data: {
      productId: prodToner.id,
      actorUserId: admin.id,
      type: 'IN',
      quantity: 2,
      stockBefore: 0,
      stockAfter: 2,
      source: 'SYSTEM',
      notes: 'Saldo awal toner cadangan',
      createdAt: d3Ago,
    },
  });

  await prisma.stockMovement.create({
    data: {
      productId: prodToner.id,
      actorUserId: admin.id,
      type: 'OUT',
      quantity: 2,
      stockBefore: 2,
      stockAfter: 0,
      source: 'WEB',
      notes: 'Penggantian darurat toner printer direktur dan finance',
      createdAt: d1Ago,
    },
  });

  // Pulpen transactions
  await prisma.stockMovement.create({
    data: {
      productId: prodPen.id,
      actorUserId: admin.id,
      type: 'IN',
      quantity: 15,
      stockBefore: 0,
      stockAfter: 15,
      source: 'SYSTEM',
      notes: 'Saldo awal migrasi',
      createdAt: d3Ago,
    },
  });

  await prisma.stockMovement.create({
    data: {
      productId: prodPen.id,
      actorUserId: userAhmad.id,
      type: 'OUT',
      quantity: 3,
      stockBefore: 15,
      stockAfter: 12,
      source: 'WEB',
      notes: 'Starter kit onboarding karyawan baru divisi engineering',
      createdAt: d2Ago,
    },
  });

  // Lakban
  await prisma.stockMovement.create({
    data: {
      productId: prodTape.id,
      actorUserId: admin.id,
      type: 'IN',
      quantity: 42,
      stockBefore: 0,
      stockAfter: 42,
      source: 'SYSTEM',
      notes: 'Restock packing e-commerce bulanan',
      createdAt: d3Ago,
    },
  });

  // 6. Notifications
  await prisma.notification.create({
    data: {
      productId: prodToner.id,
      recipientUserId: admin.id,
      type: 'OUT_OF_STOCK',
      message: 'PERINGATAN: Toner HP LaserJet 85A (CE285A) telah HABIS (Stok: 0 unit). Segera lakukan pembelian!',
      dedupeKey: `out-of-stock-${prodToner.id}-${d1Ago.toISOString().split('T')[0]}`,
      isRead: false,
      createdAt: d1Ago,
    },
  });

  await prisma.notification.create({
    data: {
      productId: prodMarker.id,
      recipientUserId: admin.id,
      type: 'LOW_STOCK',
      message: 'PERHATIAN: Spidol Whiteboard Snowman Hitam tersisa 8 pcs, berada di bawah batas minimum (15 pcs).',
      dedupeKey: `low-stock-${prodMarker.id}-${d1Ago.toISOString().split('T')[0]}`,
      isRead: false,
      createdAt: d1Ago,
    },
  });

  await prisma.notification.create({
    data: {
      productId: prodLan.id,
      recipientUserId: admin.id,
      type: 'LOW_STOCK',
      message: 'PERHATIAN: Kabel LAN UTP Belden Cat6 5M tersisa 4 pcs, berada di bawah batas minimum (8 pcs).',
      dedupeKey: `low-stock-${prodLan.id}-${d2Ago.toISOString().split('T')[0]}`,
      isRead: true,
      createdAt: d2Ago,
    },
  });

  // 7. Stock Request (Approval flow sample)
  await prisma.stockRequest.create({
    data: {
      productId: prodA4.id,
      requesterId: userSiti.id,
      quantity: 5,
      notes: 'Keperluan: Penggandaan modul training pegawai baru gelombang 4',
      status: 'PENDING',
    },
  });

  await prisma.stockRequest.create({
    data: {
      productId: prodStapler.id,
      requesterId: userDewi.id,
      quantity: 2,
      notes: 'Keperluan: Penambahan fasilitas meja kerja customer service',
      status: 'APPROVED',
      reviewedById: admin.id,
      reviewedAt: h4Ago,
    },
  });

  // 8. Telegram Update Sample Log
  await prisma.telegramUpdate.create({
    data: {
      telegramUpdateId: 'tg-upd-1001',
      chatId: '78291044',
      telegramUserId: '78291044',
      payload: JSON.stringify({
        message: {
          text: 'PAKAI\nBarang: Kertas HVS A4\nJumlah: 5\nKeperluan: Laporan rekapitulasi audit dan berkas tender',
          from: { id: 78291044, username: 'sitirahma_ops', first_name: 'Siti' },
        },
      }),
      status: 'PROCESSED',
      receivedAt: h4Ago,
      processedAt: h4Ago,
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
