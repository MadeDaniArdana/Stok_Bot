const { createHash } = require('node:crypto');
const { appendFile, mkdir, readFile } = require('node:fs/promises');
const { PrismaClient } = require('@prisma/client');
const { del, get, put } = require('@vercel/blob');

const JOURNAL = 'backups/proof-migration.jsonl';
const PUBLIC_PROOF = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/task-proofs\/[a-z0-9.-]+\.(jpg|png|webp)$/i;
const CONTENT_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const prisma = new PrismaClient();

function sources(client) {
  return [
    { model: client.installationTask, field: 'proofFileName' },
    { model: client.distribution, field: 'proofFileName' },
    { model: client.distributionProof, field: 'fileName' },
  ];
}

async function listPublicProofs() {
  const groups = await Promise.all(sources(prisma).map(async ({ model, field }) => {
    const rows = await model.findMany({
      where: { [field]: { startsWith: 'https://' } },
      select: { [field]: true },
      distinct: [field],
    });
    return rows.map((row) => row[field]).filter((url) => PUBLIC_PROOF.test(url));
  }));
  return [...new Set(groups.flat())];
}

async function migrate(references) {
  const token = process.env.PROOF_PRIVATE_BLOB_TOKEN;
  if (!token) throw new Error('Atur PROOF_PRIVATE_BLOB_TOKEN sebelum migrasi.');
  await mkdir('backups', { recursive: true });

  for (const reference of references) {
    const response = await fetch(reference, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Gagal membaca salah satu arsip publik (HTTP ${response.status}).`);

    const extension = reference.split('.').pop().toLowerCase();
    const key = createHash('sha256').update(reference).digest('hex');
    const blob = await put(`task-proofs/migrated/${key}.${extension}`, await response.arrayBuffer(), {
      access: 'private', token, contentType: CONTENT_TYPES[extension], allowOverwrite: true,
    });
    await appendFile(JOURNAL, `${JSON.stringify({ reference, privateUrl: blob.url })}\n`, { flush: true });
    await prisma.$transaction(sources(prisma).map(({ model, field }) =>
      model.updateMany({ where: { [field]: reference }, data: { [field]: blob.url } })
    ));
  }
  console.log(`${references.length} foto disalin ke penyimpanan privat dan referensinya diperbarui.`);
}

async function purge(references) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('Atur BLOB_READ_WRITE_TOKEN untuk store publik lama.');
  if (references.length) throw new Error('Masih ada referensi publik di database. Selesaikan migrasi terlebih dahulu.');

  const journal = await readFile(JOURNAL, 'utf8');
  const migrated = new Map();
  for (const line of journal.split(/\r?\n/).filter(Boolean)) {
    const { reference, privateUrl } = JSON.parse(line);
    const key = typeof reference === 'string' && createHash('sha256').update(reference).digest('hex');
    const privatePath = /^https:\/\/[a-z0-9-]+\.private\.blob\.vercel-storage\.com\/task-proofs\/migrated\/([a-f0-9]{64})\.(jpg|png|webp)$/i;
    if (!PUBLIC_PROOF.test(reference) || privatePath.exec(privateUrl)?.[1] !== key) {
      throw new Error('Jurnal migrasi berisi referensi yang tidak valid.');
    }
    migrated.set(reference, privateUrl);
  }
  const privateToken = process.env.PROOF_PRIVATE_BLOB_TOKEN;
  if (!privateToken) throw new Error('Atur PROOF_PRIVATE_BLOB_TOKEN untuk memverifikasi salinan.');
  let purged = 0;
  for (const [reference, privateUrl] of migrated) {
    const counts = await Promise.all(sources(prisma).map(({ model, field }) =>
      model.count({ where: { [field]: privateUrl } })
    ));
    if (!counts.some(Boolean)) continue;
    const copy = await get(privateUrl, { access: 'private', token: privateToken });
    if (copy?.statusCode !== 200) throw new Error('Salah satu salinan privat belum bisa dibaca.');
    await copy.stream.cancel();
    await del(reference, { token });
    purged++;
  }
  console.log(`${purged} URL publik lama dibersihkan. ${migrated.size - purged} entri tanpa referensi privat aktif dilewati.`);
}

async function main() {
  const mode = process.argv[2];
  if (process.argv.length > 3 || (mode && !['--apply', '--purge-public'].includes(mode))) {
    throw new Error('Gunakan tanpa opsi untuk memeriksa, --apply untuk migrasi, atau --purge-public untuk menghapus salinan publik.');
  }

  const references = await listPublicProofs();
  if (mode === '--apply') return migrate(references);
  if (mode === '--purge-public') return purge(references);
  console.log(`${references.length} foto lama masih memakai penyimpanan publik.`);
}

main()
  .catch((error) => {
    console.error(error.name === 'Error' ? error.message : `Migrasi gagal (${error.name}).`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
