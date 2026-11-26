import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { del, get, put } from '@vercel/blob';
import sharp from 'sharp';

// Batas body request Vercel Function sekitar 4,5 MB, jadi foto dibatasi 4 MB.
const MAX_PROOF_SIZE = 4 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const LOCAL_FILE_PATTERN = /^[a-f0-9-]+\.(jpg|png|webp)$/i;
const PUBLIC_BLOB_PATTERN = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
const PRIVATE_BLOB_PATTERN = /^https:\/\/[a-z0-9-]+\.private\.blob\.vercel-storage\.com\//i;

function getLocalProofDirectory() {
  return process.env.TASK_PROOF_DIRECTORY || path.join(process.cwd(), 'uploads', 'task-proofs');
}

function isValidImage(type: string, contents: Buffer) {
  return (
    (type === 'image/jpeg' && contents[0] === 0xff && contents[1] === 0xd8 && contents[2] === 0xff) ||
    (type === 'image/png' && contents.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (type === 'image/webp' &&
      contents.toString('ascii', 0, 4) === 'RIFF' &&
      contents.toString('ascii', 8, 12) === 'WEBP')
  );
}

const MAX_SIDE = 1600;

/**
 * Mengecilkan foto di server: sisi terpanjang maksimal 1600 px, orientasi EXIF diterapkan lalu metadata dibuang.
 * Format tetap sama dengan aslinya (agar MIME tersimpan tetap benar). Jika gagal atau hasilnya tidak lebih kecil,
 * file asli dipakai.
 */
async function compressImage(contents: Buffer, type: string): Promise<Buffer> {
  try {
    const image = sharp(contents).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
    const output = await (type === 'image/png' ? image.png({ compressionLevel: 9 }) : type === 'image/webp' ? image.webp({ quality: 80 }) : image.jpeg({ quality: 80, mozjpeg: true })).toBuffer();
    return output.length < contents.length ? output : contents;
  } catch {
    return contents;
  }
}

/** Versi kecil (WebP) untuk daftar/thumbnail, supaya halaman tidak memuat foto ukuran penuh. */
export const PROOF_WIDTHS = [240, 480, 960];
export async function resizeProof(contents: Buffer, width: number): Promise<Buffer> {
  return sharp(contents).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
}

/**
 * Menyimpan foto bukti dan mengembalikan referensinya:
 * URL Vercel Blob (produksi) atau nama file lokal (development).
 */
export async function saveTaskProof(file: File) {
  const extension = MIME_EXTENSIONS[file.type];
  if (!extension) throw new Error('Format foto harus JPEG, PNG, atau WebP.');
  if (file.size <= 0 || file.size > MAX_PROOF_SIZE) throw new Error('Ukuran foto maksimal 4 MB.');

  const original = Buffer.from(await file.arrayBuffer());
  if (!isValidImage(file.type, original)) throw new Error('Isi file bukan gambar yang valid.');
  const contents = await compressImage(original, file.type);

  const fileName = `${randomUUID()}${extension}`;

  const token = process.env.PROOF_PRIVATE_BLOB_TOKEN;
  if (token) {
    const blob = await put(`task-proofs/${fileName}`, contents, {
      access: 'private',
      token,
      contentType: file.type,
      addRandomSuffix: true,
    });
    return blob.url;
  }

  if (process.env.VERCEL) {
    // Filesystem Vercel tidak persisten; tanpa Blob foto akan hilang.
    throw new Error('Penyimpanan foto belum dikonfigurasi (PROOF_PRIVATE_BLOB_TOKEN kosong). Hubungi admin.');
  }

  const directory = getLocalProofDirectory();
  await mkdir(/*turbopackIgnore: true*/ directory, { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ directory, fileName), contents, { flag: 'wx' });
  return fileName;
}

export async function deleteTaskProof(reference: string) {
  if (PRIVATE_BLOB_PATTERN.test(reference)) {
    await del(reference, { token: getPrivateBlobToken() });
    return;
  }
  if (PUBLIC_BLOB_PATTERN.test(reference)) {
    await del(reference, { token: process.env.BLOB_READ_WRITE_TOKEN });
    return;
  }
  if (!LOCAL_FILE_PATTERN.test(reference)) return;
  await unlink(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ getLocalProofDirectory(), reference)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

function getPrivateBlobToken() {
  const token = process.env.PROOF_PRIVATE_BLOB_TOKEN;
  if (!token) throw new Error('PROOF_PRIVATE_BLOB_TOKEN belum dikonfigurasi.');
  return token;
}

export async function readTaskProof(reference: string): Promise<Buffer | null> {
  if (PRIVATE_BLOB_PATTERN.test(reference)) {
    const result = await get(reference, { access: 'private', token: getPrivateBlobToken() });
    if (result?.statusCode !== 200) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  if (PUBLIC_BLOB_PATTERN.test(reference)) {
    const response = await fetch(reference, { cache: 'no-store', redirect: 'error' });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }
  if (!LOCAL_FILE_PATTERN.test(reference)) return null;
  return readFile(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ getLocalProofDirectory(), reference)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
}
