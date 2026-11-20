import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isUserFacingError } from '@/lib/api-errors';

export type ErrorSource = 'WEB' | 'TELEGRAM' | 'AI' | 'UPLOAD' | 'NOTIFICATION' | 'BROWSER';
export type ErrorLevel = 'ERROR' | 'WARNING';

const MAX_MESSAGE = 1000;
const MAX_STACK = 6000;
const MAX_CONTEXT = 4000;
const SECRET_KEYS = /pass(word)?|token|secret|authorization|cookie|api[_-]?key/i;

/** Hapus nilai sensitif dari konteks sebelum disimpan. */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SECRET_KEYS.test(key) ? '[disembunyikan]' : sanitize(item, depth + 1),
      ])
    );
  }
  return value;
}

/**
 * Mencatat error ke tabel ErrorLog (sekaligus ke konsol). Tidak pernah melempar error,
 * sehingga aman dipanggil di dalam blok catch.
 */
export async function logError(params: {
  source: ErrorSource;
  error: unknown;
  location?: string;
  context?: Record<string, unknown>;
  level?: ErrorLevel;
}) {
  const { source, error, location, context, level = 'ERROR' } = params;
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error ?? 'Error tanpa pesan');
  const stack = error instanceof Error ? error.stack : undefined;

  console.error(`[${source}]${location ? ` ${location}` : ''}: ${message}`);

  try {
    await prisma.errorLog.create({
      data: {
        source,
        level,
        message: (message || 'Error tanpa pesan').slice(0, MAX_MESSAGE),
        location: location?.slice(0, 300) || null,
        stack: stack?.slice(0, MAX_STACK) || null,
        context: context ? JSON.stringify(sanitize(context)).slice(0, MAX_CONTEXT) : null,
      },
    });
  } catch (dbError) {
    console.error('Gagal menyimpan ErrorLog:', dbError);
  }
}

/** Error internal Next.js (misalnya saat build memeriksa route dinamis) yang harus dilempar ulang, bukan dicatat. */
function isNextInternalError(error: unknown) {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && (digest === 'DYNAMIC_SERVER_USAGE' || digest.startsWith('NEXT_'));
}

/** Untuk blok catch di route API: catat error lalu kembalikan respons 500. */
export async function apiError(error: unknown, location: string, request?: Request, publicMessage?: string) {
  if (isNextInternalError(error)) throw error;
  await logError({
    source: 'WEB',
    error,
    location,
    context: request ? { method: request.method, url: new URL(request.url).pathname + new URL(request.url).search } : undefined,
  });
  const message = publicMessage || (isUserFacingError(error) ? error.message : 'Terjadi kesalahan pada server.');
  return NextResponse.json({ error: message }, { status: 500 });
}
