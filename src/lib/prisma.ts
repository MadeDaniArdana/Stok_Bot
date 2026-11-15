import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

function getPrismaClient(): PrismaClient {
  // 1. Jika ada DATABASE_URL eksternal (misal PostgreSQL/Supabase)
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && !envUrl.startsWith('file:')) {
    return new PrismaClient({
      datasources: { db: { url: envUrl } },
    });
  }

  // 2. Jika di Vercel (Serverless Linux di mana hanya /tmp yang dapat ditulis)
  if (process.env.VERCEL) {
    const tmpDbPath = '/tmp/dev.db';
    if (!fs.existsSync(tmpDbPath)) {
      const candidatePaths = [
        path.join(process.cwd(), 'prisma', 'seed.db'),
        path.join(process.cwd(), 'seed.db'),
        path.join(__dirname, '..', '..', 'prisma', 'seed.db'),
      ];

      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          try {
            fs.copyFileSync(p, tmpDbPath);
            console.log('Successfully copied seed database to /tmp/dev.db');
            break;
          } catch (e) {
            console.error('Failed copying seed database to /tmp:', e);
          }
        }
      }
    }

    return new PrismaClient({
      datasources: { db: { url: 'file:/tmp/dev.db' } },
    });
  }

  // 3. Lokal development default (biarkan Prisma membaca dari .env/schema.prisma)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
