const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Jalankan modul TypeScript dengan database pengganti tanpa koneksi atau perubahan data asli.
function loadTypeScript(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(
    (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports
  );
  return module.exports;
}

const period = loadTypeScript('src/lib/report-period.ts');
const deletedAccount = loadTypeScript('src/lib/deleted-account.ts');
const productUnits = loadTypeScript('src/lib/product-units.ts');

function task(id, overrides = {}) {
  return {
    id, status: 'COMPLETED', createdAt: new Date('2025-12-20T10:00:00Z'),
    completedAt: new Date('2026-01-15T10:00:00Z'), proofFileName: `${id}.jpg`,
    quantity: 1, assigneeName: 'Budi', location: 'Jakarta', notes: null,
    product: { name: 'Kabel', sku: 'KB-001', unit: 'pcs' }, creator: { name: 'Admin' },
    ...overrides,
  };
}

// Distribusi Peralatan Listrik (sumber WEB) dengan link foto.
function distribution(id, overrides = {}) {
  return {
    id, number: `LST-${id}`, stockGroup: 'LISTRIK', status: 'COMPLETED',
    createdAt: new Date('2025-12-20T10:00:00Z'), proofUploadedAt: new Date('2026-01-15T10:00:00Z'),
    proofFileName: `${id}.jpg`, handoverName: 'Riki', recipientUnit: 'Perpustakaan', notes: null,
    items: [{ id: `${id}-1`, quantity: 2, unit: 'pcs', location: null, product: { name: 'Lampu LED 12 Watt', sku: 'EL-001' } }],
    // Foto per lokasi (fitur foto multi-lokasi); kosong = dokumen lama dengan satu foto di level dokumen.
    proofs: [],
    creator: { name: 'Admin' },
    ...overrides,
  };
}

function matches(row, where) {
  return Object.entries(where).every(([field, value]) => {
    if (field === 'AND') return value.every((condition) => matches(row, condition));
    if (field === 'OR') return value.some((condition) => matches(row, condition));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('gte' in value) return row[field] != null && row[field] >= value.gte && row[field] < value.lt;
      if ('contains' in value) return row[field].toLowerCase().includes(value.contains.toLowerCase());
      if ('not' in value) return row[field] !== value.not;
      if ('some' in value) return row[field].some((child) => matches(child, value.some));
      return matches(row[field], value);
    }
    return row[field] === value;
  });
}

function createAPI(rows, distributions = [], { authenticated = true } = {}) {
  const calls = [];
  const NextResponse = { json: (body, init) => ({ status: init?.status || 200, body }) };
  const route = loadTypeScript('src/app/api/tasks/route.ts', {
    'next/server': { NextResponse },
    '@/lib/auth-server': {
      requireAdmin: async () =>
        authenticated
          ? { user: { id: 'admin-test', name: 'Admin', role: 'ADMIN' }, error: null }
          : { user: null, error: NextResponse.json({ error: 'Silakan login terlebih dahulu.' }, { status: 401 }) },
    },
    '@/lib/report-period': { ...period, getCurrentReportMonth: () => '2026-02' },
    '@/lib/error-log': { apiError: (error) => { throw error; } },
    '@/lib/deleted-account': deletedAccount,
    '@/lib/product-units': productUnits,
    '@/lib/prisma': { prisma: { installationTask: {
      groupBy: async (args) => {
        calls.push({ method: 'groupBy', ...args });
        const counts = new Map();
        rows.filter((row) => matches(row, args.where)).forEach((row) => counts.set(row.status, (counts.get(row.status) || 0) + 1));
        return [...counts].map(([status, count]) => ({ status, _count: { _all: count } }));
      },
      findMany: async (args) => {
        calls.push({ method: 'findMany', ...args });
        return rows.filter((row) => matches(row, args.where)).sort((a, b) => {
          const upload = (b.completedAt?.getTime() ?? -Infinity) - (a.completedAt?.getTime() ?? -Infinity);
          return (Number.isNaN(upload) ? 0 : upload) || b.createdAt - a.createdAt || b.id.localeCompare(a.id);
        }).slice(args.skip ?? 0, (args.skip ?? 0) + args.take);
      },
    }, distribution: {
      findMany: async (args) => {
        calls.push({ method: 'distribution.findMany', ...args });
        return distributions.filter((row) => matches(row, args.where));
      },
    } } },
  });
  return { calls, get: (query = '') => route.GET({ url: `http://localhost/api/tasks${query ? `?${query}` : ''}` }) };
}

test('bulan berjalan mengikuti WIB saat tanggal UTC masih bulan sebelumnya', () => {
  assert.equal(period.getCurrentReportMonth(new Date('2026-01-31T16:59:59Z')), '2026-01');
  assert.equal(period.getCurrentReportMonth(new Date('2026-01-31T17:00:00Z')), '2026-02');
});

test('batas bulan mencakup tahun baru dan Februari tahun kabisat', () => {
  const december = period.getReportMonthRange('2026-12');
  assert.equal(december.gte.toISOString(), '2026-11-30T17:00:00.000Z');
  assert.equal(december.lt.toISOString(), '2026-12-31T17:00:00.000Z');
  const february = period.getReportMonthRange('2028-02');
  assert.equal(february.gte.toISOString(), '2028-01-31T17:00:00.000Z');
  assert.equal(february.lt.toISOString(), '2028-02-29T17:00:00.000Z');
  for (const invalid of ['', '2026-00', '2026-13', '2026-1', '26-01', '2026-01-01']) {
    assert.throws(() => period.getReportMonthRange(invalid));
  }
});

test('foto difilter menurut unggah, termasuk batas awal dan mengecualikan awal bulan berikutnya', async () => {
  const api = createAPI([
    task('january-start', { completedAt: new Date('2025-12-31T17:00:00Z') }),
    task('january-end', { completedAt: new Date('2026-01-31T16:59:59.999Z') }),
    task('february-start', { createdAt: new Date('2026-01-01T00:00:00Z'), completedAt: new Date('2026-01-31T17:00:00Z') }),
    task('december-end', { completedAt: new Date('2025-12-31T16:59:59.999Z') }),
  ]);
  const january = await api.get('month=2026-01');
  assert.deepEqual(january.body.items.map((item) => item.id), ['january-end', 'january-start']);
  const february = await api.get('month=2026-02');
  assert.deepEqual(february.body.items.map((item) => item.id), ['february-start']);
  const reopened = await api.get('month=2026-01');
  assert.deepEqual(reopened.body.items, january.body.items);
});

test('tugas menunggu foto mengikuti bulan dibuat dan bisa digabung dengan pencarian/status', async () => {
  const api = createAPI([
    task('pending-january', { status: 'PENDING', proofFileName: null, completedAt: null, createdAt: new Date('2026-01-10T10:00:00Z') }),
    task('pending-february', { status: 'PENDING', proofFileName: null, completedAt: null, createdAt: new Date('2026-02-10T10:00:00Z') }),
    task('completed-january'),
    task('other-location', { location: 'Bandung' }),
  ]);
  const pending = await api.get('month=2026-01&status=PENDING&search=kabel');
  assert.deepEqual(pending.body.items.map((item) => item.id), ['pending-january']);
  assert.equal(pending.body.items[0].photoUrl, null);
  assert.equal(pending.body.pendingCount, 1);
  assert.equal(pending.body.completedCount, 0);
  const completed = await api.get('month=2026-01&status=COMPLETED&search=jakarta');
  assert.deepEqual(completed.body.items.map((item) => item.id), ['completed-january']);
});

test('bulan berjalan menjadi default dan bulan kosong tetap kosong', async () => {
  const api = createAPI([task('old-photo')]);
  const current = await api.get();
  assert.equal(current.body.month, '2026-02');
  assert.equal(current.body.total, 0);
  assert.deepEqual(current.body.items, []);
  assert.equal(current.body.totalPages, 1);
});

test('semua arsip lebih dari 200 tugas tetap dapat dibuka, maksimal 24 kartu per halaman', async () => {
  const api = createAPI(Array.from({ length: 205 }, (_, index) => task(`task-${String(index).padStart(3, '0')}`)));
  const seen = [];
  for (let page = 1; page <= 9; page++) {
    const response = await api.get(`month=2026-01&page=${page}`);
    assert.equal(response.body.total, 205);
    assert.equal(response.body.completedCount, 205);
    assert.equal(response.body.totalPages, 9);
    assert.ok(response.body.items.length <= 24);
    seen.push(...response.body.items.map((item) => item.id));
  }
  assert.equal(new Set(seen).size, 205);
  assert.equal(seen.length, 205);
  assert.equal((await api.get('month=2026-01&page=999')).body.page, 9);
  // Tugas Telegram diambil sampai halaman yang diminta (untuk digabung dengan distribusi web), tidak pernah seluruh tabel.
  const pageCalls = api.calls.filter((call) => call.method === 'findMany');
  assert.deepEqual(pageCalls.slice(0, 9).map((call) => call.take), [1, 2, 3, 4, 5, 6, 7, 8, 9].map((page) => page * 24));
});

test('parameter bulan/halaman tidak valid ditolak sebelum mengakses database', async () => {
  const api = createAPI([]);
  for (const query of ['month=2026-13', 'month=', 'page=0', 'page=-1', 'page=1.5', 'page=NaN']) {
    assert.equal((await api.get(query)).status, 400);
  }
  assert.equal(api.calls.length, 0);
});

test('distribusi listrik dari web digabung dengan tugas Telegram dalam satu laporan', async () => {
  const api = createAPI(
    [
      task('tele-photo', { completedAt: new Date('2026-01-20T10:00:00Z') }),
      task('tele-pending', { status: 'PENDING', proofFileName: null, completedAt: null, createdAt: new Date('2026-01-05T10:00:00Z') }),
    ],
    [
      distribution('web-photo', { proofUploadedAt: new Date('2026-01-25T10:00:00Z') }),
      distribution('web-pending', { proofFileName: null, proofUploadedAt: null, createdAt: new Date('2026-01-10T10:00:00Z') }),
      distribution('web-cancelled', { status: 'CANCELLED' }),
      distribution('web-atk', { stockGroup: 'ATK' }),
      distribution('web-other-month', { proofUploadedAt: new Date('2026-02-03T10:00:00Z') }),
    ]
  );
  const all = await api.get('month=2026-01');
  // Foto terbaru dulu (web 25 Jan, tele 20 Jan), lalu menunggu foto menurut waktu dibuat terbaru.
  assert.deepEqual(all.body.items.map((item) => item.id), ['web-photo', 'tele-photo', 'web-pending', 'tele-pending']);
  assert.deepEqual(all.body.items.map((item) => item.source), ['WEB', 'TELEGRAM', 'WEB', 'TELEGRAM']);
  assert.equal(all.body.total, 4);
  assert.equal(all.body.completedCount, 2);
  assert.equal(all.body.pendingCount, 2);

  const web = all.body.items[0];
  assert.equal(web.status, 'COMPLETED');
  assert.equal(web.photoUrl, '/api/distributions/web-photo/photo');
  assert.equal(web.reference, 'LST-web-photo');
  assert.equal(web.assigneeName, 'Riki');
  assert.equal(web.location, 'Perpustakaan');
  assert.equal(web.quantityLabel, '2 pcs');
  assert.deepEqual(web.photos, [{ url: '/api/distributions/web-photo/photo', label: 'Perpustakaan' }]);
  assert.equal(all.body.items[2].photoUrl, null);
  assert.equal(all.body.items[2].status, 'PENDING');

  const pendingOnly = await api.get('month=2026-01&status=PENDING');
  assert.deepEqual(pendingOnly.body.items.map((item) => item.id), ['web-pending', 'tele-pending']);
  const searchRoom = await api.get('month=2026-01&search=perpus');
  assert.deepEqual(searchRoom.body.items.map((item) => item.id), ['web-photo', 'web-pending']);
  const searchProduct = await api.get('month=2026-01&search=lampu led');
  assert.deepEqual(searchProduct.body.items.map((item) => item.id), ['web-photo', 'web-pending']);
  const onlyWeb = await api.get('month=2026-01&source=WEB');
  assert.deepEqual(onlyWeb.body.items.map((item) => item.source), ['WEB', 'WEB']);
  const onlyTelegram = await api.get('month=2026-01&source=TELEGRAM');
  assert.deepEqual(onlyTelegram.body.items.map((item) => item.source), ['TELEGRAM', 'TELEGRAM']);
});

test('paginasi gabungan tetap 24 kartu per halaman tanpa duplikat', async () => {
  const api = createAPI(
    Array.from({ length: 30 }, (_, index) => task(`t-${String(index).padStart(2, '0')}`, { completedAt: new Date(Date.UTC(2026, 0, 2, index)) })),
    Array.from({ length: 30 }, (_, index) => distribution(`d-${String(index).padStart(2, '0')}`, { proofUploadedAt: new Date(Date.UTC(2026, 0, 2, index, 30)) }))
  );
  const seen = [];
  for (let page = 1; page <= 3; page++) {
    const response = await api.get(`month=2026-01&page=${page}`);
    assert.equal(response.body.total, 60);
    assert.equal(response.body.totalPages, 3);
    seen.push(...response.body.items.map((item) => item.id));
  }
  assert.equal(seen.length, 60);
  assert.equal(new Set(seen).size, 60);
  assert.deepEqual(seen.slice(0, 2), ['d-29', 't-29']);
});

test('nama pembuat tetap tampil setelah akunnya dihapus', async () => {
  const api = createAPI(
    [
      task('tele-live', { completedAt: new Date('2026-01-20T10:00:00Z'), creator: { name: 'Bimo' } }),
      task('tele-deleted', { completedAt: new Date('2026-01-19T10:00:00Z'), creator: null, creatorName: 'Dani' }),
    ],
    [distribution('web-deleted', { proofUploadedAt: new Date('2026-01-18T10:00:00Z'), creator: null, creatorName: 'Sri' })]
  );
  const { body } = await api.get('month=2026-01');
  assert.deepEqual(body.items.map((item) => item.creatorName), ['Bimo', 'Dani (akun dihapus)', 'Sri (akun dihapus)']);
  assert.equal(deletedAccount.personName(null, null, 'Sistem'), 'Sistem');
});

test('distribusi multi-lokasi menampilkan satu foto per lokasi', async () => {
  const api = createAPI([], [
    distribution('multi', {
      items: [
        { id: 'm-1', quantity: 1, unit: 'pcs', location: 'Gedung A', product: { name: 'Lampu LED 12 Watt', sku: 'EL-001' } },
        { id: 'm-2', quantity: 1, unit: 'pcs', location: 'Gedung B', product: { name: 'Lampu LED 12 Watt', sku: 'EL-001' } },
      ],
      proofs: [{ location: 'Gedung A' }, { location: 'Gedung B' }],
    }),
  ]);
  const [item] = (await api.get('month=2026-01')).body.items;
  assert.equal(item.photoSlots, 2);
  assert.deepEqual(item.photos.map((photo) => photo.label), ['Gedung A', 'Gedung B']);
  assert.equal(item.photos[1].url, '/api/distributions/multi/photo?location=Gedung%20B');
});

test('permintaan tanpa sesi admin ditolak 401 sebelum menyentuh database', async () => {
  const api = createAPI([task('secret')], [], { authenticated: false });
  const res = await api.get('month=2026-01');
  assert.equal(res.status, 401);
  assert.equal(api.calls.length, 0);
});

test('shiftMonth melintasi pergantian tahun (dipakai cache sisa akhir bulanan)', () => {
  const { shiftMonth } = loadTypeScript('src/services/stock-snapshot.service.ts', {
    '@/lib/prisma': { prisma: {} },
    '@/lib/report-period': period,
  });
  assert.equal(shiftMonth('2026-11', 1), '2026-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2027-01', -1), '2026-12');
  assert.equal(shiftMonth('2026-03', -15), '2024-12');
});

test('getStockParts memecah kemasan dan sisa eceran untuk tampilan tabel ringkas', () => {
  const { getStockParts } = loadTypeScript('src/lib/product-units.ts');
  assert.deepEqual(getStockParts({ unit: 'pcs' }, 12), { main: '12 pcs' });
  assert.deepEqual(getStockParts({ unit: 'pcs', packUnit: 'lusin', packSize: 12 }, 36), { main: '3 lusin' });
  assert.deepEqual(getStockParts({ unit: 'ml', packUnit: 'botol 330ml', packSize: 330 }, 150), { main: '150 ml' });
  assert.deepEqual(getStockParts({ unit: 'ml', packUnit: 'botol 330ml', packSize: 330 }, 2670), {
    main: '8 botol 330ml',
    rest: '30 ml',
  });
});

test('ACC yang gagal setelah pengurangan stok membatalkan distribusi dan bisa dicoba ulang', async () => {
  const admin = { id: 'admin', name: 'Admin' };
  const requestId = 'request-1';
  const item = { id: 'line-1', quantity: 4, productId: 'product-1' };
  let state = { status: 'PENDING', stock: 10, distribution: null };
  let failFinalUpdate = true;
  const alerts = [];
  const prisma = {
    itemRequest: {
      create: async ({ data }) => ({ ...data }),
      findFirst: async () => null,
    },
    $transaction: async (work) => {
      const next = { ...state };
      const tx = {
        itemRequest: {
          updateMany: async ({ where, data }) => {
            if (next.status !== where.status) return { count: 0 };
            next.status = data.status;
            return { count: 1 };
          },
          findUniqueOrThrow: async () => ({
            id: requestId, items: [item], stockGroup: 'ATK', number: 'PJ-202602-001',
            divisionName: 'Keuangan', requesterName: 'Pengaju',
          }),
          update: async ({ data }) => {
            if (failFinalUpdate) throw new Error('Gagal menyimpan status');
            next.status = data.status;
            return { id: requestId, ...data };
          },
        },
        itemRequestItem: { update: async () => {} },
        distribution: { findFirst: async () => next.distribution },
        applyDistribution: async (input) => {
          assert.equal(input.items[0].quantity, 2);
          next.stock -= input.items[0].quantity;
          next.distribution = { id: 'dist-1', number: 'ATK-202602-001' };
          return { distribution: next.distribution, stockAfter: [{ productId: item.productId, stock: next.stock }] };
        },
      };
      const result = await work(tx);
      state = next;
      return result;
    },
    product: {
      findMany: async () => [{ id: item.productId, isActive: true, category: { stockGroup: 'ATK' } }],
    },
  };
  const { DistributionService } = loadTypeScript('src/services/distribution.service.ts', {
    '@/lib/prisma': { prisma },
    '@/lib/report-period': period,
    '@/lib/stock-groups': {},
    './notification.service': { NotificationService: {
      checkStockLevelAndAlert: async (_id, stock) => alerts.push(stock),
    } },
    '@/lib/task-proof-storage': {},
    '@/lib/phone': {},
    '@/lib/product-units': productUnits,
  });
  DistributionService.createInTransaction = (tx, input) => tx.applyDistribution(input);
  const { RequestService } = loadTypeScript('src/services/request.service.ts', {
    '@/lib/signature-limits': loadTypeScript('src/lib/signature-limits.ts'),
    '@/lib/prisma': { prisma },
    './distribution.service': { DistributionService },
  });
  await RequestService.create({ id: 'divisi', name: 'Keuangan' }, {
    stockGroup: 'ATK', receiverName: 'Pengaju', signature: 'data:image/png;base64,YQ==',
    items: [item],
  });
  assert.equal(state.stock, 10);
  await assert.rejects(RequestService.approve(requestId, admin), /Tanda tangan admin wajib diisi/);
  assert.deepEqual(state, { status: 'PENDING', stock: 10, distribution: null });
  const approve = () => RequestService.approve(requestId, admin, {
    adminSignature: 'data:image/png;base64,YQ==',
    date: '2026-02-03',
    items: [{ id: item.id, approvedQuantity: 2 }],
  });
  await assert.rejects(approve(), /Gagal menyimpan status/);
  assert.deepEqual(state, { status: 'PENDING', stock: 10, distribution: null });
  assert.deepEqual(alerts, []);
  failFinalUpdate = false;
  assert.equal((await approve()).status, 'APPROVED');
  await assert.rejects(approve(), /sudah diproses/);
  assert.equal(state.stock, 8);
  assert.deepEqual(alerts, [8]);
});

test('posisi stok memakai tanggal distribusi dan subtotal terpisah untuk setiap satuan', async () => {
  const { Prisma } = require('@prisma/client');
  const subtotal = loadTypeScript('src/lib/stock-position-totals.ts');
  const stockGroups = loadTypeScript('src/lib/stock-groups.ts');
  let selectedPeriod = period.parseStockReportPeriod('2026-01');
  const product = (id, unit, currentStock) => ({
    id, sku: id, name: id, unit, currentStock, createdAt: new Date('2025-12-01'),
    isActive: true, category: { stockGroup: 'ATK', name: 'ATK' },
  });
  const prisma = {
    $queryRaw: (strings, ...values) => {
      const query = Prisma.sql(strings, ...values);
      assert.match(query.text, /COALESCE\(d\."distributedAt", m\."createdAt"\)/);
      assert.match(query.text, /di\."movementId" = m.id/);
      assert.ok(query.values.includes(selectedPeriod.gte));
      assert.ok(query.values.includes(selectedPeriod.lt));
      return Promise.resolve([
        { productId: 'marker', hasMovement: true, afterDelta: 8, periodDelta: 2, inQty: 5, outQty: 3 },
      ]);
    },
    product: { findMany: async () => [product('marker', 'PCS', 20), product('pen', 'pcs', 2), product('paper', 'rim', 5)] },
    $transaction: (queries, options) => {
      assert.equal(options.isolationLevel, 'RepeatableRead');
      return Promise.all(queries);
    },
  };
  const { ReportService } = loadTypeScript('src/services/report.service.ts', {
    '@/lib/prisma': { prisma },
    '@/lib/stock-groups': stockGroups,
    '@/lib/stock-position-totals': subtotal,
    '@/lib/report-period': period,
  });
  const report = await ReportService.getStockPositionReport(selectedPeriod, 'ATK');
  const marker = report.rows.find((r) => r.id === 'marker');
  assert.deepEqual([marker.openingStock, marker.inQty, marker.outQty, marker.closingStock], [10, 5, 3, 12]);
  assert.deepEqual(report.totalsByUnit.map((r) => [r.unit, r.itemCount, r.closingStock]), [
    ['pcs', 2, 14], ['rim', 1, 5],
  ]);

  for (const [month, expected] of [
    ['2026-11', [15, 0, 15, 12]],
    ['2026-12', [10, 5, 15, 12]],
  ]) {
    selectedPeriod = period.parseStockReportPeriod(month);
    const position = await ReportService.getStockPositionReport(selectedPeriod, 'ATK');
    const row = position.rows.find((item) => item.id === 'marker');
    assert.deepEqual([row.openingStock, row.inQty, row.totalAvailable, row.closingStock], expected);
  }
});

test('template otomatis dicocokkan berdasarkan divisi dan menghindari pilihan ambigu', () => {
  const { findDivisionTemplate } = loadTypeScript('src/lib/division-options.ts');
  const warek = { id: 'warek', name: 'Warek', recipientUnit: 'Tata Usaha Warek' };
  const ftik = { id: 'ftik', name: 'FTIK', recipientUnit: 'Tata Usaha FTIK' };
  assert.equal(findDivisionTemplate(' TU  Warek ', [warek, ftik]), warek);
  assert.equal(findDivisionTemplate('FTIK', [warek, ftik]), ftik);
  assert.equal(findDivisionTemplate('Keuangan', [warek, ftik]), undefined);
  assert.equal(findDivisionTemplate('Tata Usaha FTIK', [ftik, { ...ftik, id: 'other' }]), undefined);
});

test('tautan foto hanya berlaku untuk rute, lokasi, dan waktu yang ditandatangani', () => {
  const { createProofPhotoLink, verifyProofPhotoLink } = loadTypeScript('src/lib/proof-photo-link.ts', {
    '@/lib/session': { getAuthSecret: () => 'a-test-key-used-only-in-this-test-suite' },
  });
  const route = '/api/distributions/proof/test-token/photo';
  const query = new URL(createProofPhotoLink(route, 'Ruang A'), 'https://stockflow.test').searchParams;
  assert.equal(verifyProofPhotoLink(route, query), true);
  assert.equal(verifyProofPhotoLink(route.replace('test-token', 'other-token'), query), false);
  query.set('location', 'Ruang B');
  assert.equal(verifyProofPhotoLink(route, query), false);
  query.set('location', 'Ruang A');
  query.set('expires', '1');
  assert.equal(verifyProofPhotoLink(route, query), false);
});

test('paket yang dipakai akun baru dapat dihapus setelah akun dipindah', async () => {
  const accounts = [{ id: 'account', name: 'Akun ATK', divisionName: 'FTIK' }];
  const operations = [];
  const tx = {
    $queryRaw: async () => [{ id: 'original' }],
    user: {
      findMany: async () => accounts,
      updateMany: async (args) => operations.push(['move', args]),
    },
    distributionTemplate: {
      findFirst: async ({ where }) => where.id === 'replacement' ? { id: where.id } : null,
      delete: async (args) => operations.push(['delete', args]),
    },
  };
  const { DistributionTemplateService } = loadTypeScript('src/services/distribution-template.service.ts', {
    '@/lib/prisma': { prisma: { $transaction: (work) => work(tx) } },
    '@/lib/stock-groups': loadTypeScript('src/lib/stock-groups.ts'),
  });
  assert.deepEqual(await DistributionTemplateService.remove('original'), { accounts });
  await assert.rejects(DistributionTemplateService.remove('original', 'invalid'), /paket ATK pengganti/);
  assert.deepEqual(operations, []);
  await DistributionTemplateService.remove('original', 'replacement');
  assert.deepEqual(operations, [
    ['move', { where: { requestTemplateId: 'original' }, data: { requestTemplateId: 'replacement' } }],
    ['delete', { where: { id: 'original' } }],
  ]);
});

test('barang dengan mutasi tetap dilindungi meski stoknya sudah nol', async () => {
  const tx = {
    $queryRaw: async () => [{ name: 'Spidol', currentStock: 0 }],
    stockMovement: { findFirst: async () => ({ id: 'movement' }) },
  };
  const { ProductService } = loadTypeScript('src/services/product.service.ts', {
    '@/lib/prisma': { prisma: { $transaction: (work) => work(tx) } },
    './stock-snapshot.service': {},
    '@/lib/product-units': productUnits,
    '@/lib/unit-guard': {},
  });
  await assert.rejects(ProductService.deleteProduct('marker'), /riwayat mutasi/);
});

test('login menerapkan batas bersama sebelum memeriksa kata sandi', async () => {
  const buckets = new Map();
  let checks = 0;
  const prisma = {
    $executeRaw: async () => 0,
    $transaction: async (work) => {
      const next = new Map(buckets);
      const result = await work({
        $queryRaw: async (_sql, key, expiresAt) => {
          const count = (next.get(key) ?? 0) + 1;
          next.set(key, count);
          return [{ count, expiresAt }];
        },
      });
      next.forEach((count, key) => buckets.set(key, count));
      return result;
    },
    user: { findUnique: async () => null },
  };
  const loadRoute = () => loadTypeScript('src/app/api/auth/login/route.ts', {
    '@/lib/prisma': { prisma },
    '@/lib/password': { verifyPassword: async () => { checks++; return false; } },
    '@/lib/session': {},
  });
  const first = loadRoute();
  const second = loadRoute();
  const request = (email, ip) => new Request('https://stockflow.test/api/auth/login', {
    method: 'POST',
    headers: { 'x-real-ip': ip },
    body: JSON.stringify({ email, password: 'a-test-password' }),
  });
  for (let i = 0; i < 5; i++) {
    assert.equal((await first.POST(request('test@stockflow.test', '192.0.2.4'))).status, 401);
  }
  const limited = await second.POST(request(' TEST@stockflow.test ', '192.0.2.5'));
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal(checks, 5);
});

test('laporan Excel mempertahankan logo, filter, tipe data, dan subtotal', async () => {
  const { ValueType, Workbook } = require('exceljs');
  const { excelDateWib, excelReportResponse } = loadTypeScript('src/lib/excel-report.ts');
  const response = await excelReportResponse({
    filename: 'uji-posisi-stok',
    sheetName: 'Posisi Stok',
    title: 'Laporan Posisi Stok',
    period: 'November 2026',
    columns: [['Barang', 24], ['Jumlah', 14], ['Waktu (WIB)', 22, 'dd/mm/yyyy hh:mm']],
    rows: (function* () {
      yield ['=HYPERLINK("https://example.invalid")', 5, excelDateWib(new Date('2026-11-25T17:00:00Z'))];
    })(),
    subtotals: [['Subtotal', 5, null]],
  });
  assert.match(response.headers.get('content-disposition'), /uji-posisi-stok\.xlsx/);
  const workbook = new Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());
  const sheet = workbook.getWorksheet('Posisi Stok');
  assert.equal(sheet.getImages().length, 1);
  assert.equal(sheet.views[0].ySplit, 6);
  assert.equal(sheet.autoFilter, 'A6:C7');
  assert.equal(sheet.getCell('A7').type, ValueType.String);
  assert.equal(sheet.getCell('B7').value, 5);
  assert.equal(sheet.getCell('C7').value.toISOString(), '2026-11-26T00:00:00.000Z');
  assert.equal(sheet.getCell('B8').font.bold, true);
});

test('sesi dicabut di database dan perubahan versi akun menolak token lama', async () => {
  const sid = 'a'.repeat(64);
  const expiresAt = new Date(Date.now() + 60_000);
  const payload = { sid, uid: 'admin', role: 'ADMIN', version: 3, exp: Math.floor(expiresAt.getTime() / 1000) };
  let record = { expiresAt, user: { id: 'admin', role: 'ADMIN', isActive: true, sessionVersion: 3 } };
  const sessionModule = { SESSION_COOKIE: 'stockflow_session', verifySessionToken: async () => payload };
  const prisma = { webSession: {
    findUnique: async ({ where }) => where.id === sid ? record : null,
    deleteMany: async ({ where }) => {
      assert.deepEqual(where, { id: sid, userId: 'admin' });
      record = null;
    },
  } };
  const { getSessionUser } = loadTypeScript('src/lib/auth-server.ts', {
    '@/lib/prisma': { prisma },
    '@/lib/session': sessionModule,
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'cookie' }) }) },
  });
  assert.equal((await getSessionUser(false)).id, 'admin');
  record.user.sessionVersion++;
  assert.equal(await getSessionUser(false), null);
  record.user.sessionVersion--;
  const { POST } = loadTypeScript('src/app/api/auth/logout/route.ts', {
    '@/lib/prisma': { prisma }, '@/lib/session': sessionModule,
  });
  const result = await POST({ cookies: { get: () => ({ value: 'cookie' }) } });
  assert.equal(result.status, 200);
  assert.equal(await getSessionUser(false), null);
});

test('proxy menolak mutasi lintas situs dan hanya membuka path publik yang tepat', async () => {
  const { NextRequest } = require('next/server');
  const { proxy } = loadTypeScript('src/proxy.ts', {
    '@/lib/session': { SESSION_COOKIE: 'stockflow_session', verifySessionToken: async () => null },
  });
  const request = (path, headers = {}) => new NextRequest('https://stok.example.invalid' + path, { method: 'POST', headers });
  assert.equal((await proxy(request('/api/auth/login', { 'sec-fetch-site': 'cross-site' }))).status, 403);
  assert.equal((await proxy(request('/api/auth/login', { origin: 'https://other.example.invalid' }))).status, 403);
  assert.equal((await proxy(request('/api/auth/login', { origin: 'https://stok.example.invalid' }))).status, 200);
  assert.equal((await proxy(request('/api/auth/login-other'))).status, 401);
  assert.equal((await proxy(request('/api/logs/client'))).status, 401);
});
