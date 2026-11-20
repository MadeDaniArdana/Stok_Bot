import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-server';

export async function POST() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  return NextResponse.json(
    { error: 'Barang keluar sekarang hanya dapat dicatat melalui penyelesaian tugas pemasangan.' },
    { status: 410 }
  );
}
