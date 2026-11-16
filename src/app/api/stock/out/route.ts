import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Barang keluar sekarang hanya dapat dicatat melalui penyelesaian tugas pemasangan.' },
    { status: 410 }
  );
}
