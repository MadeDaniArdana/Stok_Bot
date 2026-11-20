/**
 * Token sesi bertanda tangan HMAC-SHA256 (Web Crypto), bisa dipakai di middleware (Edge) maupun route Node.
 * Format: base64url(payload JSON).base64url(tanda tangan)
 */
export const SESSION_COOKIE = 'stockflow_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

export interface SessionPayload {
  uid: string;
  role: string;
  exp: number; // detik sejak epoch
}

function getSecret() {
  const secret = process.env.AUTH_SECRET || '';
  if (secret.length < 32 || secret.startsWith('replace-')) {
    throw new Error('AUTH_SECRET belum diset atau kurang dari 32 karakter.');
  }
  return secret;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getKey() {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSessionToken(uid: string, role: string) {
  const payload: SessionPayload = { uid, role, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await getKey(), new TextEncoder().encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  if (!body || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await getKey(),
      fromBase64Url(signature),
      new TextEncoder().encode(body)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (!payload.uid || typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
