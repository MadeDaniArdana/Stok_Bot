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

function task(id, overrides = {}) {
  return {
    id, status: 'COMPLETED', createdAt: new Date('2025-12-20T10:00:00Z'),
    completedAt: new Date('2026-01-15T10:00:00Z'), proofFileName: `${id}.jpg`,
    quantity: 1, assigneeName: 'Budi', location: 'Jakarta', notes: null,
    product: { name: 'Kabel', sku: 'KB-001', unit: 'pcs' }, creator: { name: 'Admin' },
    ...overrides,
  };
}

function matches(row, where) {
  return Object.entries(where).every(([field, value]) => {
    if (field === 'AND') return value.every((condition) => matches(row, condition));
    if (field === 'OR') return value.some((condition) => matches(row, condition));
    if (value && typeof value === 'object') {
      if ('gte' in value) return row[field] != null && row[field] >= value.gte && row[field] < value.lt;
      if ('contains' in value) return row[field].toLowerCase().includes(value.contains.toLowerCase());
      return matches(row[field], value);
    }
    return row[field] === value;
  });
}

function createAPI(rows) {
  const calls = [];
  const route = loadTypeScript('src/app/api/tasks/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ status: init?.status || 200, body }) } },
    '@/lib/report-period': { ...period, getCurrentReportMonth: () => '2026-02' },
    '@/lib/error-log': { apiError: (error) => { throw error; } },
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
        }).slice(args.skip, args.skip + args.take);
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
  assert.ok(api.calls.filter((call) => call.method === 'findMany').every((call) => call.take === 24));
});

test('parameter bulan/halaman tidak valid ditolak sebelum mengakses database', async () => {
  const api = createAPI([]);
  for (const query of ['month=2026-13', 'month=', 'page=0', 'page=-1', 'page=1.5', 'page=NaN']) {
    assert.equal((await api.get(query)).status, 400);
  }
  assert.equal(api.calls.length, 0);
});
