import { prisma } from '@/lib/prisma';

/** ID Telegram dari env TELEGRAM_ADMIN_IDS (tidak bisa dihapus dari web). */
export function getEnvAdminIds() {
  return (process.env.TELEGRAM_ADMIN_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Semua ID Telegram yang boleh menjadi admin bot: env + yang ditambahkan dari web. */
export async function getAllowedAdminIds() {
  const fromDb = await prisma.telegramAdmin.findMany({ select: { telegramUserId: true } });
  return Array.from(new Set([...getEnvAdminIds(), ...fromDb.map((row) => row.telegramUserId)]));
}
