import { createHmac, timingSafeEqual } from 'node:crypto';
import { getAuthSecret } from '@/lib/session';

const PHOTO_LINK_TTL_SECONDS = 15 * 60;

function sign(path: string, location: string, expires: number) {
  return createHmac('sha256', getAuthSecret())
    .update(JSON.stringify(['proof-photo', path, location, expires]))
    .digest('hex');
}

export function createProofPhotoLink(path: string, location = '') {
  const expires = Math.floor(Date.now() / 1000) + PHOTO_LINK_TTL_SECONDS;
  const query = new URLSearchParams({ expires: String(expires), signature: sign(path, location, expires) });
  if (location) query.set('location', location);
  return `${path}?${query}`;
}

export function verifyProofPhotoLink(path: string, query: URLSearchParams) {
  const expires = Number(query.get('expires'));
  const signature = query.get('signature') ?? '';
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expires) || expires <= now || expires > now + PHOTO_LINK_TTL_SECONDS) return false;
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = sign(path, query.get('location') ?? '', expires);
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}
