import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getEnvAdminIds } from '@/lib/telegram-admins';
import { requireAdmin, SAFE_USER_SELECT } from '@/lib/auth-server';
import { hashPassword } from '@/lib/password';
import { apiError } from '@/lib/error-log';
import { isUserFacingError } from '@/lib/api-errors';
import { normalizeDivisionName } from '@/lib/division-options';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const currentUser = auth.user;
    const { id } = await params;

    const { name, role, password, isActive, telegramUserId, telegramUsername, unlinkTelegram, divisionName, requestTemplateId } = await req.json();

    if (password !== undefined && (typeof password !== 'string' || password.length < 8 || password.length > 1024)) {
      return NextResponse.json({ error: 'Kata sandi harus berisi 8 sampai 1024 karakter.' }, { status: 400 });
    }
    if (role !== undefined && role !== 'ADMIN' && role !== 'USER' && role !== 'DIVISI') {
      return NextResponse.json({ error: 'Peran pengguna tidak valid.' }, { status: 400 });
    }
    if (currentUser.id === id) {
      if (isActive === false) {
        return NextResponse.json({ error: 'Anda tidak dapat menonaktifkan akun yang sedang dipakai login.' }, { status: 400 });
      }
      if (role !== undefined && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Anda tidak dapat menurunkan peran akun yang sedang dipakai login.' }, { status: 400 });
      }
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { role: true, passwordHash: true },
    });
    if (!target) return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    const isDivision = (role ?? target.role) === 'DIVISI';
    const division = normalizeDivisionName(divisionName);
    if (isDivision && (divisionName !== undefined || target.role !== 'DIVISI') && (!division || division.length > 100)) {
      return NextResponse.json({ error: 'Nama divisi wajib diisi dan maksimal 100 karakter.' }, { status: 400 });
    }
    if (isDivision && target.role !== 'DIVISI' && !target.passwordHash && !password) {
      return NextResponse.json({ error: 'Atur kata sandi untuk akun divisi.' }, { status: 400 });
    }
    if (isDivision && requestTemplateId !== undefined && requestTemplateId !== null &&
        (typeof requestTemplateId !== 'string' || !await prisma.distributionTemplate.findFirst({
          where: { id: requestTemplateId, stockGroup: 'ATK' }, select: { id: true },
        }))) {
      return NextResponse.json({ error: 'Pilih template ATK yang tersedia.' }, { status: 400 });
    }

    // ID admin Telegram otomatis tertaut ulang oleh bot, jadi hak admin-nya harus dicabut agar putusnya permanen.
    if (unlinkTelegram) {
      const link = await prisma.telegramUser.findUnique({ where: { userId: id } });
      if (link) {
        if (getEnvAdminIds().includes(link.telegramUserId)) {
          return NextResponse.json(
            { error: 'ID ini admin dari TELEGRAM_ADMIN_IDS di Vercel, hapus dari sana agar tautan tidak terbentuk lagi.' },
            { status: 400 }
          );
        }
        await prisma.telegramAdmin.deleteMany({ where: { telegramUserId: link.telegramUserId } });
        await prisma.telegramConversation.deleteMany({ where: { telegramUserId: link.telegramUserId } });
      }
    }

    await prisma.user.update({
      where: { id },
      data: {
        name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
        role: role ?? undefined,
        divisionName: isDivision ? division || undefined : null,
        requestTemplateId: isDivision ? requestTemplateId : null,
        passwordHash: password ? await hashPassword(password) : undefined,
        sessionVersion: password || (role !== undefined && role !== target.role) || isActive === false
          ? { increment: 1 }
          : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      select: { id: true },
    });

    if (unlinkTelegram) {
      await prisma.telegramUser.deleteMany({
        where: { userId: id },
      });
    } else if (telegramUserId) {
      await prisma.telegramUser.upsert({
        where: { userId: id },
        update: {
          telegramUserId: String(telegramUserId).trim(),
          telegramChatId: String(telegramUserId).trim(),
          username: telegramUsername ? telegramUsername.trim() : null,
          isActive: true,
        },
        create: {
          userId: id,
          telegramUserId: String(telegramUserId).trim(),
          telegramChatId: String(telegramUserId).trim(),
          username: telegramUsername ? telegramUsername.trim() : null,
          isActive: true,
        },
      });
    }

    const finalUser = await prisma.user.findUnique({
      where: { id },
      select: {
        ...SAFE_USER_SELECT,
        telegram: true,
      },
    });

    return NextResponse.json({ success: true, user: finalUser });
  } catch (error: any) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'PATCH /api/users/[id]', req, 'Data pengguna gagal diperbarui. Detail tercatat di menu Log Error.');
  }
}

/**
 * Hapus akun secara permanen (web + Telegram).
 * Riwayat tetap utuh: transaksi stok, dokumen distribusi, dan tugas pemasangan yang dibuat akun ini
 * tetap tersimpan, dan nama akun disalin ke catatan tersebut (tampil "Nama (akun dihapus)").
 * Ikut dihapus: tautan Telegram, status admin bot, percakapan bot, dan notifikasi milik akun ini.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const currentUser = auth.user;
    const { id } = await params;
    if (currentUser.id === id) {
      return NextResponse.json({ error: 'Anda tidak dapat menghapus akun yang sedang dipakai login.' }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id }, include: { telegram: true } });
    if (!target) return NextResponse.json({ error: 'Akun tidak ditemukan atau sudah dihapus.' }, { status: 404 });

    const telegramId = target.telegram?.telegramUserId;
    // Admin dari env otomatis dibuat ulang oleh bot, jadi penghapusan tidak akan permanen.
    if (telegramId && getEnvAdminIds().includes(telegramId)) {
      return NextResponse.json(
        { error: 'ID Telegram akun ini ada di TELEGRAM_ADMIN_IDS (Vercel). Hapus dari sana dulu, lalu hapus akunnya di sini.' },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      if (telegramId) {
        await tx.telegramAdmin.deleteMany({ where: { telegramUserId: telegramId } });
        await tx.telegramConversation.deleteMany({ where: { telegramUserId: telegramId } });
      }
      await tx.telegramUser.deleteMany({ where: { userId: target.id } });
      // Salin nama ke catatan yang dibuat akun ini agar riwayat tetap menunjukkan pelakunya.
      await tx.stockMovement.updateMany({ where: { actorUserId: target.id }, data: { actorName: target.name } });
      await tx.installationTask.updateMany({ where: { creatorUserId: target.id }, data: { creatorName: target.name } });
      await tx.distribution.updateMany({ where: { creatorUserId: target.id }, data: { creatorName: target.name } });
      // Notifikasi ikut terhapus (cascade); tautan akun pada catatan di atas menjadi kosong, namanya tetap tersimpan.
      await tx.user.delete({ where: { id: target.id } });
    });

    return NextResponse.json({ success: true, message: `Akun ${target.name} telah dihapus.` });
  } catch (error) {
    if (isUserFacingError(error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return apiError(error, 'DELETE /api/users/[id]', req, 'Akun gagal dihapus. Detail tercatat di menu Log Error.');
  }
}
