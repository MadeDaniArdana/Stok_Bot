// Mengatur akun admin dari .env (ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD) tanpa menghapus data lain.
// Jalankan: npm run admin:reset
// - Admin yang tertaut Telegram (atau admin pertama) diubah menjadi akun ini, jadi tautan Telegram & riwayat tetap utuh.
// - Admin lain dihapus; jika punya riwayat tugas/stok, cukup dinonaktifkan.
const { PrismaClient } = require('@prisma/client');
const { randomBytes, scryptSync } = require('crypto');

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const name = (process.env.ADMIN_NAME || '').trim();
const password = process.env.ADMIN_PASSWORD || '';
if (!email || !name || !password) {
  console.error('ADMIN_EMAIL, ADMIN_NAME, dan ADMIN_PASSWORD wajib diisi di .env');
  process.exit(1);
}

// Format sama dengan src/lib/password.ts: scrypt:<salt hex>:<hash hex>
const salt = randomBytes(16);
const passwordHash = `scrypt:${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  console.log('Admin sebelum:', admins.map((admin) => `${admin.name} <${admin.email}>`));

  const linked = await prisma.telegramUser.findMany({ where: { userId: { in: admins.map((admin) => admin.id) } } });
  const keep = admins.find((admin) => linked.some((link) => link.userId === admin.id)) || admins[0];

  await prisma.$transaction(async (tx) => {
    // Lepas email target dari pengguna lain supaya tidak bentrok.
    await tx.user.updateMany({
      where: { email, NOT: keep ? { id: keep.id } : undefined },
      data: { email: `lama-${Date.now()}@invalid.local` },
    });

    if (keep) {
      await tx.user.update({ where: { id: keep.id }, data: { email, name, passwordHash, sessionVersion: { increment: 1 }, isActive: true, role: 'ADMIN' } });
    } else {
      await tx.user.create({ data: { email, name, passwordHash, role: 'ADMIN', isActive: true } });
    }

    for (const admin of admins.filter((item) => item.id !== keep?.id)) {
      const [tasks, movements] = await Promise.all([
        tx.installationTask.count({ where: { creatorUserId: admin.id } }),
        tx.stockMovement.count({ where: { actorUserId: admin.id } }),
      ]);
      await tx.telegramUser.deleteMany({ where: { userId: admin.id } });
      if (tasks || movements) {
        await tx.user.update({ where: { id: admin.id }, data: { role: 'USER', isActive: false, passwordHash: null, sessionVersion: { increment: 1 } } });
      } else {
        await tx.notification.deleteMany({ where: { recipientUserId: admin.id } });
        await tx.user.delete({ where: { id: admin.id } });
      }
    }
  });

  const after = await prisma.user.findMany({ where: { role: 'ADMIN' }, include: { telegram: true } });
  console.log(
    'Admin sesudah:',
    after.map((admin) => `${admin.name} <${admin.email}> | Telegram: ${admin.telegram?.telegramUserId ?? '-'} | kata sandi: ${admin.passwordHash ? 'ada' : 'kosong'}`)
  );
}

main()
  .catch((error) => {
    console.error('Gagal mengatur admin:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
