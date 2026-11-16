import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { del, put } from '@vercel/blob';

// Batas body request Vercel Function sekitar 4,5 MB, jadi foto dibatasi 4 MB.
const MAX_PROOF_SIZE = 4 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const LOCAL_FILE_PATTERN = /^[a-f0-9-]+\.(jpg|png|webp)$/i;
const BLOB_HOST_PATTERN = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;

/** Vercel Blob dipakai jika token tersedia (produksi). Tanpa token, foto disimpan di folder lokal. */
function useBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

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

/**
 * Menyimpan foto bukti dan mengembalikan referensinya:
 * URL Vercel Blob (produksi) atau nama file lokal (development).
 */
export async function saveTaskProof(file: File) {
  const extension = MIME_EXTENSIONS[file.type];
  if (!extension) throw new Error('Format foto harus JPEG, PNG, atau WebP.');
  if (file.size <= 0 || file.size > MAX_PROOF_SIZE) throw new Error('Ukuran foto maksimal 4 MB.');

  const contents = Buffer.from(await file.arrayBuffer());
  if (!isValidImage(file.type, contents)) throw new Error('Isi file bukan gambar yang valid.');

  const fileName = `${randomUUID()}${extension}`;

  if (useBlobStorage()) {
    const blob = await put(`task-proofs/${fileName}`, contents, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: true,
    });
    return blob.url;
  }

  if (process.env.VERCEL) {
    // Filesystem Vercel tidak persisten; tanpa Blob foto akan hilang.
    throw new Error('Penyimpanan foto belum dikonfigurasi (BLOB_READ_WRITE_TOKEN kosong). Hubungi admin.');
  }

  const directory = getLocalProofDirectory();
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), contents, { flag: 'wx' });
  return fileName;
}

export async function deleteTaskProof(reference: string) {
  if (BLOB_HOST_PATTERN.test(reference)) {
    await del(reference);
    return;
  }
  if (!LOCAL_FILE_PATTERN.test(reference)) return;
  await unlink(path.join(getLocalProofDirectory(), reference)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

export async function readTaskProof(reference: string): Promise<Buffer | null> {
  if (BLOB_HOST_PATTERN.test(reference)) {
    const response = await fetch(reference, { cache: 'no-store' });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }
  if (!LOCAL_FILE_PATTERN.test(reference)) return null;
  return readFile(path.join(getLocalProofDirectory(), reference)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
}
