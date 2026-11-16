import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return NextResponse.json({ error: 'Belum login.' }, { status: 401 });
    return NextResponse.json({ currentUser });
  } catch (error) {
    console.error('Failed to load session:', error);
    return NextResponse.json({ error: 'Sesi tidak dapat dimuat.' }, { status: 500 });
  }
}
