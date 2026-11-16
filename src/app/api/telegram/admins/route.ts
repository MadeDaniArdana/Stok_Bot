import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEnvAdminIds } from '@/lib/telegram-admins';

export const dynamic = 'force-dynamic';

const TELEGRAM_ID_PATTERN = /^\d{4,15}$/;

/** Pengirim pesan dari payload update Telegram (pesan biasa atau tombol). */
function senderFromPayload(payload: string | null) {
  try {
    const data = JSON.parse(payload || '{}');
    const from = data?.message?.from || data?.callback_query?.from;
    if (!from?.id) return null;
    return {
      telegramUserId: String(from.id),
      username: from.username ? String(from.username) : null,
      name: [from.first_name, from.last_name].filter(Boolean).join(' ') || null,
    };
  } catch {
    return null;
  }
}

// Dilindungi middleware: hanya admin web yang sudah login.
export async function GET() {
  try {
    const envIds = getEnvAdminIds();
    const [webAdmins, links, updates] = await Promise.all([
      prisma.telegramAdmin.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.telegramUser.findMany({ include: { user: { select: { name: true } } } }),
      prisma.telegramUpdate.findMany({ orderBy: { receivedAt: 'desc' }, take: 200, select: { payload: true, receivedAt: true } }),
    ]);

    const linkById = new Map(links.map((link) => [link.telegramUserId, link]));
    const allIds = new Set([...envIds, ...webAdmins.map((admin) => admin.telegramUserId)]);

    const admins = [
      ...envIds.map((telegramUserId) => ({ telegramUserId, label: null as string | null, source: 'env' as const })),
      ...webAdmins
        .filter((admin) => !envIds.includes(admin.telegramUserId))
        .map((admin) => ({ telegramUserId: admin.telegramUserId, label: admin.label, source: 'web' as const })),
    ].map((admin) => {
      const link = linkById.get(admin.telegramUserId);
      return {
        ...admin,
        linkedName: link?.user.name ?? null,
        username: link?.username ?? null,
      };
    });

    // Orang yang baru menghubungi bot tapi belum menjadi admin (untuk ditambahkan sekali klik).
    const candidates = new Map<string, { telegramUserId: string; username: string | null; name: string | null; lastSeen: Date }>();
    for (const update of updates) {
      const sender = senderFromPayload(update.payload);
      if (!sender || allIds.has(sender.telegramUserId) || candidates.has(sender.telegramUserId)) continue;
      candidates.set(sender.telegramUserId, { ...sender, lastSeen: update.receivedAt });
      if (candidates.size >= 10) break;
    }

    const botUsername = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
    return NextResponse.json({
      botUsername,
      botUrl: botUsername ? `https://t.me/${botUsername}` : null,
      admins,
      candidates: Array.from(candidates.values()),
    });
  } catch (error) {
    console.error('Failed to load Telegram admins:', error);
    return NextResponse.json({ error: 'Daftar admin Telegram tidak dapat dimuat.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const telegramUserId = String(body?.telegramUserId ?? '').trim();
    const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 60) : '';

    if (!TELEGRAM_ID_PATTERN.test(telegramUserId)) {
      return NextResponse.json({ error: 'ID Telegram harus berupa angka (4–15 digit).' }, { status: 400 });
    }
    if (getEnvAdminIds().includes(telegramUserId)) {
      return NextResponse.json({ error: 'ID ini sudah terdaftar sebagai admin.' }, { status: 409 });
    }

    const admin = await prisma.telegramAdmin.upsert({
      where: { telegramUserId },
      update: { label: label || undefined },
      create: { telegramUserId, label: label || null },
    });
    return NextResponse.json({ success: true, admin }, { status: 201 });
  } catch (error) {
    console.error('Failed to add Telegram admin:', error);
    return NextResponse.json({ error: 'Gagal menambahkan admin Telegram.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const telegramUserId = new URL(req.url).searchParams.get('telegramUserId')?.trim() || '';
    if (getEnvAdminIds().includes(telegramUserId)) {
      return NextResponse.json(
        { error: 'ID ini berasal dari TELEGRAM_ADMIN_IDS di Vercel, hapus dari sana.' },
        { status: 400 }
      );
    }

    const removed = await prisma.telegramAdmin.deleteMany({ where: { telegramUserId } });
    if (!removed.count) return NextResponse.json({ error: 'ID tidak ditemukan.' }, { status: 404 });

    // Putuskan juga tautan akunnya, kalau tidak ia tetap bisa memakai bot sebagai pengguna biasa.
    await prisma.telegramUser.deleteMany({ where: { telegramUserId } });
    // Hentikan percakapan yang sedang berjalan agar akses admin langsung tertutup.
    await prisma.telegramConversation.deleteMany({ where: { telegramUserId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to remove Telegram admin:', error);
    return NextResponse.json({ error: 'Gagal menghapus admin Telegram.' }, { status: 500 });
  }
}
