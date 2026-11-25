/**
 * Utilitas lintas-platform (Windows & Linux) untuk membungkus (dump), memulihkan (restore),
 * dan memverifikasi migrasi database PostgreSQL StockFlow ke Docker.
 *
 * Pemakaian:
 *   npm run db:dump                 -> Dump DB dari DATABASE_URL (.env) ke backups/stockflow-<ts>.sql & backups/latest.sql
 *   npm run db:restore              -> Restore backups/latest.sql ke container Docker `db`
 *   npm run db:restore -- <file>    -> Restore file SQL tertentu ke container Docker `db`
 *   npm run db:verify               -> Bandingkan jumlah baris setiap tabel antara DATABASE_URL (.env) vs Docker `db`
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BACKUPS_DIR = path.join(ROOT, 'backups');
const PG_IMAGE = process.env.POSTGRES_IMAGE || 'postgres:18-alpine';

function loadEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

const fileEnv = loadEnvFile(path.join(ROOT, '.env'));
const getEnv = (key, fallback = '') => process.env[key] || fileEnv[key] || fallback;

function getDockerDbConfig() {
  return {
    user: getEnv('POSTGRES_USER', 'stockflow'),
    password: getEnv('POSTGRES_PASSWORD', 'stockflow_local_dev'),
    db: getEnv('POSTGRES_DB', 'stockflow'),
    port: getEnv('POSTGRES_PORT', '5432'),
  };
}

function getDockerDatabaseUrl() {
  const { user, password, db, port } = getDockerDbConfig();
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/${encodeURIComponent(db)}?schema=public`;
}

function maskUrl(raw) {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ''}${u.pathname}`;
  } catch {
    return '(invalid URL)';
  }
}

/** Neon pooler URL (ep-xxx-pooler...) diubah ke direct endpoint agar pg_dump stabil 100%. */
function toDirectDumpUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.hostname.includes('-pooler.') && u.hostname.endsWith('.neon.tech')) {
      u.hostname = u.hostname.replace('-pooler.', '.');
    }
    // pg_dump tidak mengenal parameter Prisma `schema=` atau `channel_binding=` tertentu
    u.searchParams.delete('schema');
    return u.toString();
  } catch {
    return raw;
  }
}

function runDump(customUrl) {
  const sourceUrl = customUrl || getEnv('DIRECT_URL') || getEnv('DATABASE_URL');
  if (!sourceUrl) {
    console.error('Error: DATABASE_URL tidak ditemukan di .env atau environment.');
    process.exit(1);
  }
  const dumpUrl = toDirectDumpUrl(sourceUrl);
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const outFile = path.join(BACKUPS_DIR, `stockflow-${stamp}.sql`);
  const latestFile = path.join(BACKUPS_DIR, 'latest.sql');

  console.log(`Membungkus database dari ${maskUrl(dumpUrl)} menggunakan ${PG_IMAGE}...`);
  const res = spawnSync(
    'docker',
    [
      'run',
      '--rm',
      '-e',
      `DUMP_URL=${dumpUrl}`,
      PG_IMAGE,
      'sh',
      '-c',
      'pg_dump "$DUMP_URL" --no-owner --no-privileges --clean --if-exists --format=plain --encoding=UTF8',
    ],
    { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }
  );

  if (res.status !== 0) {
    console.error('pg_dump gagal:\n', res.stderr || res.error);
    process.exit(res.status || 1);
  }
  if (!res.stdout || res.stdout.trim().length < 50) {
    console.error('Hasil dump kosong atau terlalu kecil.');
    process.exit(1);
  }

  fs.writeFileSync(outFile, res.stdout, 'utf8');
  fs.writeFileSync(latestFile, res.stdout, 'utf8');
  const kb = (Buffer.byteLength(res.stdout, 'utf8') / 1024).toFixed(1);
  console.log(`Berhasil menyimpan SQL dump (${kb} KB):`);
  console.log(`  - ${path.relative(ROOT, outFile)}`);
  console.log(`  - ${path.relative(ROOT, latestFile)}`);
}

function runRestore(targetArg) {
  const sqlFile = targetArg ? path.resolve(ROOT, targetArg) : path.join(BACKUPS_DIR, 'latest.sql');
  if (!fs.existsSync(sqlFile)) {
    console.error(`File backup tidak ditemukan: ${sqlFile}`);
    console.error('Jalankan `npm run db:dump` terlebih dahulu.');
    process.exit(1);
  }

  const { user, db } = getDockerDbConfig();
  console.log(`Merestore ${path.relative(ROOT, sqlFile)} ke container Docker db (database=${db})...`);
  const sqlContent = fs.readFileSync(sqlFile, 'utf8');

  // Bersihkan schema public terlebih dahulu agar restore dari dump selalu bersih & idempotent.
  const reset = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'db',
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      user,
      '-d',
      db,
      '-c',
      'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;',
    ],
    { cwd: ROOT, encoding: 'utf8' }
  );
  if (reset.status !== 0) {
    console.error('Gagal menyiapkan schema di container Docker db. Pastikan `docker compose up -d db` sudah berjalan.\n', reset.stderr || reset.error);
    process.exit(reset.status || 1);
  }

  const res = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'db', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', user, '-d', db],
    { cwd: ROOT, input: sqlContent, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' }
  );
  if (res.status !== 0) {
    console.error('Restore gagal:\n', res.stderr || res.error);
    process.exit(res.status || 1);
  }

  console.log('Restore SQL selesai. Sinkronisasi skema Prisma terbaru (`prisma db push`)...');
  const prismaCli = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');
  const push = spawnSync(
    process.execPath,
    [prismaCli, 'db', 'push', '--skip-generate'],
    { cwd: ROOT, env: { ...process.env, DATABASE_URL: getDockerDatabaseUrl() }, stdio: 'inherit' }
  );
  if (push.status !== 0) {
    process.exit(push.status || 1);
  }
  console.log('Skema & data di Docker PostgreSQL siap digunakan.');
}

async function queryCounts(databaseUrl) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const tables = await prisma.$queryRawUnsafe(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);
    const counts = {};
    for (const { tablename } of tables) {
      const r = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS cnt FROM "${tablename}"`);
      counts[tablename] = Number(r[0].cnt);
    }
    return counts;
  } finally {
    await prisma.$disconnect();
  }
}

async function runVerify() {
  const sourceUrl = getEnv('DATABASE_URL');
  const targetUrl = getDockerDatabaseUrl();
  if (!sourceUrl) {
    console.error('Error: DATABASE_URL sumber tidak ditemukan di .env.');
    process.exit(1);
  }
  console.log(`Membandingkan:\n  Sumber : ${maskUrl(sourceUrl)}\n  Docker : ${maskUrl(targetUrl)}\n`);
  const [src, dst] = await Promise.all([queryCounts(sourceUrl), queryCounts(targetUrl)]);
  const allTables = Array.from(new Set([...Object.keys(src), ...Object.keys(dst)])).sort();

  let mismatch = 0;
  for (const table of allTables) {
    const a = src[table];
    const b = dst[table];
    const ok = a === b;
    if (!ok) mismatch += 1;
    console.log(`${ok ? 'OK  ' : 'DIFF'} | ${table.padEnd(26)} | sumber=${String(a ?? '-').padStart(5)} | docker=${String(b ?? '-').padStart(5)}`);
  }
  if (mismatch > 0) {
    console.error(`\nTerdapat ${mismatch} tabel yang berbeda.`);
    process.exit(1);
  }
  console.log(`\nSempurna: ${allTables.length}/${allTables.length} tabel identik 100%.`);
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'dump') {
    runDump(arg);
  } else if (cmd === 'restore') {
    runRestore(arg);
  } else if (cmd === 'verify') {
    await runVerify();
  } else {
    console.log('Pemakaian: node scripts/db-docker.mjs <dump|restore|verify> [arg]');
    process.exit(1);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
