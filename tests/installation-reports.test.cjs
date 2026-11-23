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
