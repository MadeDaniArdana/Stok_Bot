import { NextResponse } from 'next/server';

function requestsDisabled() {
  return NextResponse.json(
    { error: 'Permintaan dan persetujuan stok tidak lagi dikelola melalui web. Gunakan alur tugas Telegram.' },
    { status: 410 }
  );
}

export async function GET() { return requestsDisabled(); }
export async function POST() { return requestsDisabled(); }
export async function PATCH() { return requestsDisabled(); }
