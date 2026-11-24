// Backup semua tabel ke backups/backup-<timestamp>.json (read-only terhadap DB).
// Jalankan: npm run db:backup
const { PrismaClient, Prisma } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

(async () => {
  const prisma = new PrismaClient();
  const data = {};
  for (const { name } of Prisma.dmmf.datamodel.models) {
    const delegate = prisma[name[0].toLowerCase() + name.slice(1)];
    data[name] = await delegate.findMany();
    console.log(`${name}: ${data[name].length} baris`);
  }
  await prisma.$disconnect();

  const dir = path.join(__dirname, "..", "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  console.log("Tersimpan:", file);
})().catch((e) => { console.error(e); process.exit(1); });
