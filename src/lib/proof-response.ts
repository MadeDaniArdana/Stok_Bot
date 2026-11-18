import { NextRequest, NextResponse } from 'next/server';
import { PROOF_WIDTHS, resizeProof } from '@/lib/task-proof-storage';

/**
 * Respons foto bukti. Dengan ?w=240|480|960 foto dikecilkan (WebP) dan di-cache browser;
 * tanpa ?w foto asli (yang sudah dikompres saat upload) dikirim apa adanya.
 */
export async function proofResponse(request: NextRequest, photo: Buffer, mimeType: string, cacheControl: string) {
  const width = Number(request.nextUrl.searchParams.get('w'));
  let body = photo;
  let type = mimeType;
  if (PROOF_WIDTHS.includes(width)) {
    try {
      body = await resizeProof(photo, width);
      type = 'image/webp';
    } catch {
      // Gagal dikecilkan: kirim foto asli.
    }
  }
  return new NextResponse(new Uint8Array(body), {
    headers: { 'Content-Type': type, 'Cache-Control': cacheControl, 'X-Content-Type-Options': 'nosniff' },
  });
}
