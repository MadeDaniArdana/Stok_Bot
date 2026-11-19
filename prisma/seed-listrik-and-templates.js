/**
 * Mengisi / memperbarui:
 * 1. 15 barang Peralatan Listrik (kategori Elektronik, stok awal 0, stok min 3)
 * 2. 20 barang Kebersihan & Sanitasi tambahan dari Template barang CS Logistik.xlsx (stok awal 0)
 * 3. 17 template Distribusi Logistik (14 template CS berisi checklist dari Excel + 3 template non-CS)
 * 4. 12 template divisi untuk Distribusi ATK berdasarkan ATK.pdf
 *
 * Aman dijalankan berulang tanpa menyentuh barang ATK/Logistik lama, mutasi stok, atau akun pengguna.
 *
 * Jalankan: npm run db:seed-templates
 */
const { PrismaClient } = require('@prisma/client');

const LISTRIK_PRODUCTS = [
  'LED Philips 12 Watt Putih',
  'LED Philips 12 Watt Kuning',
  'LED Philips 14,5 Watt Putih',
  'TL 18 Watt',
  'TL 32 Watt',
  'TL Ring',
  'Lampu Sorot 7 Watt Kuning',
  'Lampu Sorot 7 Watt Putih',
  'Lampu Sorot 20 Watt Putih',
  'Lampu Sorot 20 Watt Kuning',
  'Lampu Sorot 50 Watt Kuning',
  'Lampu Sorot 50 Watt Putih',
  'Lampu Sorot 100 Watt Putih',
  'Stater',
  'Travo Elektrik',
];

const NEW_CLEAN_PRODUCTS = [
  ['KEBERSIHAN-SANITASI-019', 'Pembersih Kaca Cling Botol', 'botol'],
  ['KEBERSIHAN-SANITASI-020', 'Citrun', 'pcs'],
  ['KEBERSIHAN-SANITASI-021', 'Ember', 'pcs'],
  ['KEBERSIHAN-SANITASI-022', 'Gayung', 'pcs'],
  ['KEBERSIHAN-SANITASI-023', 'Gunting', 'pcs'],
  ['KEBERSIHAN-SANITASI-024', 'Kanebo', 'pcs'],
  ['KEBERSIHAN-SANITASI-025', 'Koret', 'pcs'],
  ['KEBERSIHAN-SANITASI-026', 'Kotak Sampah', 'pcs'],
  ['KEBERSIHAN-SANITASI-027', 'Kuas', 'pcs'],
  ['KEBERSIHAN-SANITASI-028', 'Lap Putih', 'pcs'],
  ['KEBERSIHAN-SANITASI-029', 'Megic', 'pcs'],
  ['KEBERSIHAN-SANITASI-030', 'Micin', 'pcs'],
  ['KEBERSIHAN-SANITASI-031', 'Minyak Lemon', 'botol'],
  ['KEBERSIHAN-SANITASI-032', 'Pel Lantai Clean Matic', 'pcs'],
  ['KEBERSIHAN-SANITASI-033', 'Pewangi Baju', 'pcs'],
  ['KEBERSIHAN-SANITASI-034', 'Sabun Cuci Tangan', 'pcs'],
  ['KEBERSIHAN-SANITASI-035', 'Serokan Sampah', 'pcs'],
  ['KEBERSIHAN-SANITASI-036', 'Soda Kue', 'pcs'],
  ['KEBERSIHAN-SANITASI-037', 'Rinso', 'pcs'],
  ['KEBERSIHAN-SANITASI-038', 'Tisu', 'pcs'],
];

const CS_BASE_BEFORE_GUNTING = [
  'Baygon Semprot 600 ml',
  'Pembersih Kaca Cling Botol',
  'Citrun',
  'Ember',
  'Gayung',
];

const CS_BASE_MIDDLE = [
  'Ijo-Ijo Scotch Brite',
  'Kapur Barus Besar Dahlia Warna Warni',
  'Kanebo',
  'Keset Welcome',
  'Koret',
  'Kotak Sampah',
  'Kuas',
  'Lap Putih',
  'Megic',
  'Micin',
  'Minyak Lemon',
  'Pel Lantai Clean Matic',
  'Pewangi Karpet Ginger Kecil',
  'Pewangi Baju',
  'Pewangi Ruangan Glade, Stella, Dahlia',
  'Plastik Sampah Uk. 100 x 120',
  'Pel Lantai Refill Clean Matic',
  'Pembersih Kaca Refill Cling',
  'Sabun Colek Wings 1000 Biru',
  'Sabun Cuci Tangan',
  'Sapu Lidi',
  'Sapu Lantai Nagata',
  'Serokan Sampah',
  'Soda Kue',
  'Pengharum Kamar Mandi SOS Carbol 800gr',
  'Spons Cuci Piring Scotch Brite',
  'Sabun Cuci Piring Sunlight',
];

const CS_BASE_END = [
  'Tissue Nice Refill Besar',
  'Tissue Mobil Nice Refill Kecil',
];

function buildCsItems({ gunting = false, tisu = false, rinso = false } = {}) {
  return [
    ...CS_BASE_BEFORE_GUNTING,
    ...(gunting ? ['Gunting'] : []),
    ...CS_BASE_MIDDLE,
    ...(tisu ? ['Tisu'] : []),
    ...(rinso ? ['Rinso'] : []),
    ...CS_BASE_END,
  ];
}

const LOGISTIK_TEMPLATES = [
  // 14 petugas CS (urutan dan variasi item sesuai Template barang CS Logistik.xlsx)
  { name: 'Aswindra', recipientUnit: 'Aswindra', storageLocation: null, receiverName: 'Aswindra', items: buildCsItems() },
  { name: 'Erna', recipientUnit: 'Erna', storageLocation: null, receiverName: 'Erna', items: buildCsItems({ rinso: true }) },
  { name: 'Erni', recipientUnit: 'Erni', storageLocation: null, receiverName: 'Erni', items: buildCsItems() },
  { name: 'Hendrik', recipientUnit: 'Hendrik', storageLocation: null, receiverName: 'Hendrik', items: buildCsItems() },
  { name: 'Maida', recipientUnit: 'Maida', storageLocation: null, receiverName: 'Maida', items: buildCsItems({ tisu: true, rinso: true }) },
  { name: 'Mala Dewi', recipientUnit: 'Mala Dewi', storageLocation: null, receiverName: 'Mala Dewi', items: buildCsItems({ rinso: true }) },
  { name: 'Mastoni', recipientUnit: 'Mastoni', storageLocation: null, receiverName: 'Mastoni', items: buildCsItems({ rinso: true }) },
  { name: 'Murlina', recipientUnit: 'Murlina', storageLocation: null, receiverName: 'Murlina', items: buildCsItems({ gunting: true }) },
  { name: 'Neneng', recipientUnit: 'Neneng', storageLocation: null, receiverName: 'Neneng', items: buildCsItems({ rinso: true }) },
  { name: 'Riki', recipientUnit: 'Riki', storageLocation: null, receiverName: 'Riki', items: buildCsItems({ gunting: true }) },
  { name: 'Rumlah', recipientUnit: 'Rumlah', storageLocation: null, receiverName: 'Rumlah', items: buildCsItems() },
  { name: 'Uli', recipientUnit: 'Uli', storageLocation: null, receiverName: 'Uli', items: buildCsItems() },
  { name: 'Vicky', recipientUnit: 'Vicky', storageLocation: null, receiverName: 'Vicky', items: buildCsItems() },
  { name: 'Wilyati', recipientUnit: 'Wilyati', storageLocation: null, receiverName: 'Wilyati', items: buildCsItems() },
  // 3 unit/lokasi tambahan (tetap kosong)
  { name: 'AI CENTER', recipientUnit: 'AI CENTER', storageLocation: null, receiverName: null, items: null },
  { name: 'Satpam', recipientUnit: 'Satpam', storageLocation: null, receiverName: null, items: null },
  { name: 'Marbot Masjid Asmaul Yusuf', recipientUnit: 'Marbot Masjid Asmaul Yusuf', storageLocation: null, receiverName: null, items: null },
];

const ATK_TEMPLATES = [
  {
    name: 'FTIK',
    recipientUnit: 'Tata Usaha FTIK',
    storageLocation: 'FTIK',
    receiverName: null,
    items: [
      ['Kertas HVS A4 Sidu 75 gr', 40],
      ['Kertas HVS F4 Sidu 75 gr', 15],
    ],
  },
  {
    name: 'FSIP',
    recipientUnit: 'Tata Usaha FSIP',
    storageLocation: 'FSIP',
    receiverName: null,
    items: [
      ['Kertas HVS A4 Sidu 75 gr', 30],
      ['Kertas HVS F4 Sidu 75 gr', 15],
      ['Kertas Bergaris Folio/F4', 2],
      ['Kertas HVS Warna F4 (Biru & Hijau)', 3],
      ['Refill Pena Joyko Biru 1 mm', 1],
      ['Lakban Handeru Bening', 2],
      ['Lakban Handeru Hitam', 1],
      ['Isolasi Handeru 1/2', 4],
      ['Double Tape Kenko Kecil 12mm', 5],
      ['Tinta Spidol Snowman Whiteboard Biru', 6],
      ['Tinta Spidol Snowman Whiteboard Hitam', 12],
    ],
  },
  {
    name: 'FEB',
    recipientUnit: 'Tata Usaha FEB',
    storageLocation: 'FEB',
    receiverName: null,
    items: [
      ['Kertas HVS A4 Sidu 75 gr', 30],
      ['Kertas HVS F4 Sidu 75 gr', 15],
      ['Kertas HVS F4 Sidu 60 gr', 10],
      ['Pena Tizzo Hitam', 8],
      ['Pena Kenko Hitam Easy Jel 0,5mm', 14],
      ['Refill Pena Joyko Biru 1 mm', 1],
      ['Pensil Faber-Castell', 3],
      ['Peruncing Faber-Castell Kecil', 3],
      ['Lakban Handeru Bening', 2],
      ['Isolasi Handeru 1/2', 4],
      ['Stapler Max HD10', 2],
      ['Double Tape Kenko Besar 24mm', 3],
      ['Gunting Sedang Kenko 838', 1],
      ['Cutter Kenko L150', 1],
      ['Isi Cutter Kenko L150', 2],
      ['Stabilo Boss (Hijau, Kuning, Pink, Orange, Pastel)', 2],
      ['Paper Clip Kenko No. 3', 1],
      ['Binder Clip Kenko 105', 4],
      ['Binder Clip Kenko 155', 3],
      ['Business File (Biru, Kuning, Orange)', 6],
      ['Spidol Whiteboard Snowman Hitam', 6],
    ],
  },
  {
    name: 'Kemahasiswaan',
    recipientUnit: 'Tata Usaha Kemahasiswaan',
    storageLocation: 'Kemahasiswaan',
    receiverName: null,
    items: [
      ['Kertas HVS A4 Sidu 75 gr', 10],
      ['Kertas HVS F4 Sidu 75 gr', 3],
      ['Pena Tizzo Hitam', 8],
      ['Pena Kenko Hitam Easy Jel 0,5mm', 14],
      ['Refill Pena Joyko Biru 1 mm', 1],
      ['Lakban Handeru Bening', 2],
      ['Isolasi Handeru 1/2', 4],
      ['Isi Stapler Kenko No. 10-1M', 2],
      ['Double Tape Kenko Besar 24mm', 3],
      ['Map Kabita (Pink & Biru)', 3],
      ['Stabilo Boss (Hijau, Kuning, Pink, Orange, Pastel)', 2],
      ['Paper Clip Kenko No. 3', 1],
    ],
  },
  {
    name: 'TU Warek',
    recipientUnit: 'Tata Usaha Warek',
    storageLocation: 'TU Warek',
    receiverName: null,
    items: [
      ['Kertas HVS A4 Sidu 75 gr', 8],
      ['Kertas HVS F4 Sidu 75 gr', 1],
      ['Pena Tizzo Hitam', 8],
      ['Pena Tizzo Biru', 12],
      ['Pena Kenko Biru Easy Jel 0,5mm', 18],
      ['Pena Kenko Hitam Easy Jel 0,5mm', 14],
      ['Lakban Handeru Bening', 2],
      ['Isolasi Handeru 1/2', 4],
      ['Tape Dispenser Isolasi Lion No. 50', 1],
      ['Stapler Max HD10', 2],
      ['Double Tape Kenko Kecil 12mm', 5],
      ['Double Tape Kenko Besar 24mm', 3],
      ['Gunting Besar Kenko 848', 1],
      ['Gunting Sedang Kenko 838', 1],
      ['Cutter Kenko L150', 1],
      ['Stabilo Boss (Hijau, Kuning, Pink, Orange, Pastel)', 2],
      ['Paper Clip Kenko No. 3', 1],
      ['Binder Clip Kenko 105', 4],
      ['Sticky Note Besar', 2],
      ['Post It Sign Here', 6],
      ['Tinta Stamp Pad Biru Joyko', 2],
    ],
  },
  {
    name: 'LPPM',
    recipientUnit: 'Tata Usaha LPPM',
    storageLocation: 'LPPM',
    receiverName: null,
    items: [
      ['Kertas HVS A4 Sidu 75 gr', 6],
      ['Pena Tizzo Hitam', 8],
      ['Pensil Faber-Castell', 3],
      ['Penggaris Besi', 1],
      ['Lakban Handeru Bening', 2],
      ['Lakban Handeru Hitam', 1],
      ['Isolasi Handeru 1/2', 4],
      ['Double Tape Kenko Kecil 12mm', 5],
      ['Double Tape Kenko Besar 24mm', 3],
      ['Map Kabita (Pink & Biru)', 3],
      ['Paper Clip Kenko No. 3', 1],
      ['Binder Clip Kenko 155', 3],
      ['Spidol Whiteboard Snowman Hitam', 6],
      ['Lem Kenko Stick 25gr', 1],
      ['PP Pocket Benex F4', 7],
    ],
  },
  {
    name: 'LPBM',
    recipientUnit: 'Tata Usaha LPBM',
    storageLocation: 'LPBM',
    receiverName: null,
    items: [
      ['Kertas HVS A4 Sidu 75 gr', 15],
      ['Kertas HVS F4 Sidu 75 gr', 10],
      ['Kertas HVS Warna F4 (Biru & Hijau)', 3],
      ['Lakban Handeru Bening', 2],
      ['Isolasi Handeru 1/2', 4],
      ['Tape Dispenser Isolasi Joyko TD 103', 1],
      ['Stapler Max HD10', 2],
      ['Gunting Besar Kenko 848', 1],
      ['Gunting Sedang Kenko 838', 1],
      ['Cutter Kenko L150', 1],
      ['Isi Cutter Kenko L150', 2],
      ['Pembolong Kertas Besar Punch Joyko JK85B', 1],
      ['Map Kabita (Pink & Biru)', 3],
      ['Stabilo Boss (Hijau, Kuning, Pink, Orange, Pastel)', 2],
      ['Paper Clip Kenko No. 3', 1],
      ['Odner Besar Hitam Gobi', 24],
      ['Sticky Note Besar', 2],
      ['Business File (Biru, Kuning, Orange)', 6],
      ['PP Pocket Benex F4', 7],
      ['Tipe-X Kenko 01', 2],
    ],
  },
  {
    name: 'TU Prodi',
    recipientUnit: 'Tata Usaha Prodi',
    storageLocation: 'TU Prodi',
    receiverName: null,
    items: [
      ['Pena Tizzo Hitam', 8],
      ['Pena Kenko Hitam Easy Jel 0,5mm', 14],
      ['Map Kabita (Pink & Biru)', 3],
      ['Stabilo Boss (Hijau, Kuning, Pink, Orange, Pastel)', 2],
      ['Paper Clip Kenko No. 3', 1],
      ['Sticky Note Besar', 2],
      ['Business File (Biru, Kuning, Orange)', 6],
      ['Lem Kenko Stick 25gr', 1],
    ],
  },
  {
    name: 'TU SI',
    recipientUnit: 'Tata Usaha Prodi SI',
    storageLocation: 'TU SI',
    receiverName: null,
    items: [['Kertas HVS A4 Sidu 75 gr', 11]],
  },
  {
    name: 'TU IF',
    recipientUnit: 'Tata Usaha Prodi IF',
    storageLocation: 'TU IF',
    receiverName: null,
    items: [
      ['Kertas HVS A4 Sidu 75 gr', 10],
      ['Kertas HVS F4 Sidu 75 gr', 2],
    ],
  },
  {
    name: 'Perpustakaan',
    recipientUnit: 'Tata Usaha Perpustakaan',
    storageLocation: 'Perpustakaan',
    receiverName: null,
    items: [
      ['Kertas HVS A4 Sidu 75 gr', 3],
      ['Pena Tizzo Hitam', 8],
      ['Penggaris Besi', 1],
      ['Lakban Handeru Bening', 2],
      ['Isolasi Handeru 1/2', 4],
      ['Tape Dispenser Isolasi Joyko TD 103', 1],
      ['Tape Dispenser Isolasi Lion No. 50', 1],
      ['Isi Stapler Kenko No. 10-1M', 2],
      ['Gunting Besar Kenko 848', 1],
      ['Gunting Sedang Kenko 838', 1],
      ['Stabilo Boss (Hijau, Kuning, Pink, Orange, Pastel)', 2],
      ['Paper Clip Kenko No. 3', 1],
      ['Binder Clip Kenko 155', 3],
      ['Binder Clip Kenko No. 200', 2],
      ['Binder Clip Kenko No. 260', 2],
      ['Binder Clip Kenko No. 280', 2],
    ],
  },
  {
    name: 'Informasi',
    recipientUnit: 'Tata Usaha Informasi',
    storageLocation: 'Informasi',
    receiverName: null,
    items: [
      ['Kertas HVS A4 Sidu 75 gr', 16],
      ['Kertas HVS F4 Sidu 75 gr', 8],
      ['Pena Kenko Biru Easy Jel 0,5mm', 18],
      ['Pena Kenko Hitam Easy Jel 0,5mm', 14],
      ['Pensil Faber-Castell', 3],
      ['Peruncing Faber-Castell Kecil', 3],
      ['Penggaris Besi', 1],
      ['Lakban Handeru Bening', 2],
      ['Isolasi Handeru 1/2', 4],
      ['Tape Dispenser Isolasi Lion No. 50', 1],
      ['Stapler Max HD10', 2],
      ['Double Tape Kenko Kecil 12mm', 5],
      ['Gunting Besar Kenko 848', 1],
      ['Gunting Sedang Kenko 838', 1],
      ['Cutter Kenko L150', 1],
      ['Isi Cutter Kenko L150', 2],
      ['Pembolong Kertas Besar Punch Joyko JK85B', 1],
      ['Stabilo Boss (Hijau, Kuning, Pink, Orange, Pastel)', 2],
      ['Paper Clip Kenko No. 3', 1],
      ['Binder Clip Kenko 105', 4],
      ['Binder Clip Kenko 155', 3],
      ['Business File (Biru, Kuning, Orange)', 6],
      ['Tipe-X Kenko 01', 2],
    ],
  },
];

async function seedListrikAndTemplates(prisma) {
  console.log('Mengisi barang Peralatan Listrik serta template Logistik & ATK...');

  // 1. Pastikan kategori Elektronik (LISTRIK) ada, lalu isi/perbarui 15 barang Listrik.
  const catElektronik = await prisma.category.upsert({
    where: { id: 'cat-elektronik' },
    update: {
      name: 'Elektronik',
      stockGroup: 'LISTRIK',
      description: 'Lampu, kabel listrik, stop kontak, saklar, dan perlengkapan instalasi listrik gedung.',
    },
    create: {
      id: 'cat-elektronik',
      name: 'Elektronik',
      stockGroup: 'LISTRIK',
      description: 'Lampu, kabel listrik, stop kontak, saklar, dan perlengkapan instalasi listrik gedung.',
    },
  });

  // Hapus barang LISTRIK lama yang tidak memiliki referensi agar daftar bersih sesuai 15 item baru.
  await prisma.product.deleteMany({
    where: {
      category: { stockGroup: 'LISTRIK' },
      movements: { none: {} },
      distributionItems: { none: {} },
      installationTasks: { none: {} },
      templateItems: { none: {} },
    },
  });

  for (let i = 0; i < LISTRIK_PRODUCTS.length; i += 1) {
    const name = LISTRIK_PRODUCTS[i];
    const sku = `ELEKTRONIK-${String(i + 1).padStart(3, '0')}`;
    await prisma.product.upsert({
      where: { sku },
      update: {
        name,
        categoryId: catElektronik.id,
        unit: 'pcs',
        packUnit: null,
        packSize: null,
        minimumStock: 3,
        isActive: true,
      },
      create: {
        sku,
        name,
        categoryId: catElektronik.id,
        unit: 'pcs',
        currentStock: 0,
        minimumStock: 3,
        isActive: true,
      },
    });
  }

  // 2. Pastikan kategori Kebersihan & Sanitasi ada dan tambahkan 20 barang CS baru (stok awal 0, tidak menimpa stok yang sudah ada).
  const catClean = await prisma.category.upsert({
    where: { id: 'cat-clean' },
    update: {
      name: 'Kebersihan & Sanitasi',
      stockGroup: 'LOGISTIK',
      description: 'Perlengkapan kebersihan petugas CS, sabun, pembersih, pewangi, tisu, sapu, dan plastik sampah.',
    },
    create: {
      id: 'cat-clean',
      name: 'Kebersihan & Sanitasi',
      stockGroup: 'LOGISTIK',
      description: 'Perlengkapan kebersihan petugas CS, sabun, pembersih, pewangi, tisu, sapu, dan plastik sampah.',
    },
  });

  for (const [sku, name, unit] of NEW_CLEAN_PRODUCTS) {
    await prisma.product.upsert({
      where: { sku },
      update: {
        name,
        categoryId: catClean.id,
        unit,
        minimumStock: 2,
        isActive: true,
        description: 'Perlengkapan CS (Template barang CS Logistik.xlsx)',
      },
      create: {
        sku,
        name,
        categoryId: catClean.id,
        unit,
        currentStock: 0,
        minimumStock: 2,
        isActive: true,
        description: 'Perlengkapan CS (Template barang CS Logistik.xlsx)',
      },
    });
  }

  // 3. Upsert 17 template LOGISTIK (14 CS dari Excel dengan quantity=0; 3 unit non-CS dibiarkan kosong/tidak menimpa isian admin).
  const logistikProducts = await prisma.product.findMany({
    where: { category: { stockGroup: 'LOGISTIK' } },
    select: { id: true, name: true },
  });
  const logistikByName = new Map(logistikProducts.map((p) => [p.name.trim().toLowerCase(), p]));

  let logistikItemCount = 0;
  for (const tpl of LOGISTIK_TEMPLATES) {
    if (Array.isArray(tpl.items)) {
      const resolvedItems = tpl.items.map((productName, index) => {
        const product = logistikByName.get(productName.trim().toLowerCase());
        if (!product) {
          throw new Error(`Barang Logistik "${productName}" pada template "${tpl.name}" tidak ditemukan di database.`);
        }
        return { productId: product.id, quantity: 0, sortOrder: index };
      });

      const existing = await prisma.distributionTemplate.findUnique({
        where: { stockGroup_name: { stockGroup: 'LOGISTIK', name: tpl.name } },
        select: { id: true },
      });

      if (existing) {
        await prisma.distributionTemplateItem.deleteMany({ where: { templateId: existing.id } });
        await prisma.distributionTemplate.update({
          where: { id: existing.id },
          data: {
            recipientUnit: tpl.recipientUnit,
            storageLocation: tpl.storageLocation,
            receiverName: tpl.receiverName,
            items: { create: resolvedItems },
          },
        });
      } else {
        await prisma.distributionTemplate.create({
          data: {
            stockGroup: 'LOGISTIK',
            name: tpl.name,
            recipientUnit: tpl.recipientUnit,
            storageLocation: tpl.storageLocation,
            receiverName: tpl.receiverName,
            items: { create: resolvedItems },
          },
        });
      }

      logistikItemCount += resolvedItems.length;
    } else {
      await prisma.distributionTemplate.upsert({
        where: { stockGroup_name: { stockGroup: 'LOGISTIK', name: tpl.name } },
        update: {
          recipientUnit: tpl.recipientUnit,
          storageLocation: tpl.storageLocation,
          receiverName: tpl.receiverName,
        },
        create: {
          stockGroup: 'LOGISTIK',
          name: tpl.name,
          recipientUnit: tpl.recipientUnit,
          storageLocation: tpl.storageLocation,
          receiverName: tpl.receiverName,
        },
      });
    }
  }

  // 4. Upsert 12 template divisi ATK dari ATK.pdf.
  const atkProducts = await prisma.product.findMany({
    where: { category: { stockGroup: 'ATK' } },
    select: { id: true, name: true },
  });
  const atkByName = new Map(atkProducts.map((p) => [p.name.trim().toLowerCase(), p]));

  let atkItemCount = 0;
  for (const tpl of ATK_TEMPLATES) {
    const resolvedItems = tpl.items.map(([productName, quantity], index) => {
      const product = atkByName.get(productName.trim().toLowerCase());
      if (!product) {
        throw new Error(`Barang ATK "${productName}" pada template "${tpl.name}" tidak ditemukan di database.`);
      }
      return { productId: product.id, quantity, sortOrder: index };
    });

    const existing = await prisma.distributionTemplate.findUnique({
      where: { stockGroup_name: { stockGroup: 'ATK', name: tpl.name } },
      select: { id: true },
    });

    if (existing) {
      await prisma.distributionTemplateItem.deleteMany({ where: { templateId: existing.id } });
      await prisma.distributionTemplate.update({
        where: { id: existing.id },
        data: {
          recipientUnit: tpl.recipientUnit,
          storageLocation: tpl.storageLocation,
          receiverName: tpl.receiverName,
          items: { create: resolvedItems },
        },
      });
    } else {
      await prisma.distributionTemplate.create({
        data: {
          stockGroup: 'ATK',
          name: tpl.name,
          recipientUnit: tpl.recipientUnit,
          storageLocation: tpl.storageLocation,
          receiverName: tpl.receiverName,
          items: { create: resolvedItems },
        },
      });
    }

    atkItemCount += resolvedItems.length;
  }

  console.log(
    `Selesai: ${LISTRIK_PRODUCTS.length} barang Listrik, ${NEW_CLEAN_PRODUCTS.length} barang CS baru, ${LOGISTIK_TEMPLATES.length} template Logistik (${logistikItemCount} item), ${ATK_TEMPLATES.length} template ATK (${atkItemCount} item).`
  );
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedListrikAndTemplates(prisma)
    .catch((error) => {
      console.error('Gagal mengisi data Listrik & template:', error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { seedListrikAndTemplates };

