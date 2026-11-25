import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/error-log';

export const runtime = 'nodejs';

/**
 * Menerima error dari browser (halaman admin & halaman upload foto pemasang).
 * Publik karena halaman bukti foto tidak memakai login, jadi dibatasi ukuran dan frekuensinya.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const MAX_ENTRIES = 1000;
const hits = new Map<string, { count: number; start: number }>();

function getClientIp(req: NextRequest) {
  return (
    req.headers.get('x-real-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'unknown'
  );
}

function allowed(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    if (hits.size >= MAX_ENTRIES) {
      // Hapus hanya entri kedaluwarsa agar tidak mereset rate-limit IP lain.
      hits.forEach((item, key) => {
        if (now - item.start > WINDOW_MS) hits.delete(key);
      });
      while (hits.size >= MAX_ENTRIES) {
        const oldestKey = hits.keys().next().value;
        if (!oldestKey) break;
        hits.delete(oldestKey);
      }
    }
    hits.set(ip, { count: 1, start: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!allowed(ip)) return NextResponse.json({ ok: false }, { status: 429 });

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.slice(0, 1000) : '';
  if (!message) return NextResponse.json({ ok: false }, { status: 400 });

  const error = new Error(message);
  error.stack = typeof body?.stack === 'string' ? body.stack.slice(0, 6000) : undefined;

  await logError({
    source: 'BROWSER',
    error,
    location: typeof body?.page === 'string' ? body.page.slice(0, 200) : undefined,
    context: {
      jenis: typeof body?.kind === 'string' ? body.kind.slice(0, 50) : null,
      browser: req.headers.get('user-agent')?.slice(0, 200) || null,
    },
  });
  return NextResponse.json({ ok: true });
}
