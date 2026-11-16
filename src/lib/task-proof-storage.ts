import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

const MAX_PROOF_SIZE = 4 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function getProofDirectory() {
  return process.env.VERCEL
    ? path.join(os.tmpdir(), 'stockflow-task-proofs')
    : process.env.TASK_PROOF_DIRECTORY || path.join(process.cwd(), 'uploads', 'task-proofs');
}

export async function saveTaskProof(file: File) {
  const extension = MIME_EXTENSIONS[file.type];
  if (!extension) throw new Error('Format foto harus JPEG, PNG, atau WebP.');
  if (file.size <= 0 || file.size > MAX_PROOF_SIZE) throw new Error('Ukuran foto maksimal 5 MB.');

  const fileName = `${randomUUID()}${extension}`;
  const directory = getProofDirectory();
  const contents = Buffer.from(await file.arrayBuffer());
  const isValidImage =
    (file.type === 'image/jpeg' && contents[0] === 0xff && contents[1] === 0xd8 && contents[2] === 0xff) ||
    (file.type === 'image/png' && contents.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (file.type === 'image/webp' &&
      contents.toString('ascii', 0, 4) === 'RIFF' &&
      contents.toString('ascii', 8, 12) === 'WEBP');
  if (!isValidImage) throw new Error('Isi file bukan gambar yang valid.');

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), contents, { flag: 'wx' });
  return fileName;
}

export async function deleteTaskProof(fileName: string) {
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(fileName)) return;
  await unlink(path.join(getProofDirectory(), fileName)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

export async function readTaskProof(fileName: string) {
  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/i.test(fileName)) return null;
  return readFile(path.join(getProofDirectory(), fileName));
}
