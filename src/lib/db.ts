import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

function getDatabaseUrl(): string {
  // On Vercel Serverless Lambdas:
  // /var/task is read-only. /tmp is writable.
  if (process.env.VERCEL) {
    const tmpDbPath = '/tmp/dev.db';

    // Only copy initial bundle if /tmp/dev.db does not exist yet. Never overwrite runtime data!
    if (!fs.existsSync(tmpDbPath)) {
      const candidates = [
        path.join(process.cwd(), 'prisma', 'dev.db'),
        path.join('/var/task', 'prisma', 'dev.db'),
        path.join(process.cwd(), 'dev.db'),
      ];

      for (const src of candidates) {
        if (fs.existsSync(src)) {
          try {
            fs.copyFileSync(src, tmpDbPath);
            break;
          } catch (e) {
            console.error('Failed to copy database to /tmp:', e);
          }
        }
      }
    }

    if (fs.existsSync(tmpDbPath)) {
      return `file:${tmpDbPath}`;
    }
  }

  return process.env.DATABASE_URL || 'file:./dev.db';
}

const prismaClientSingleton = () => {
  const url = getDatabaseUrl();
  return new PrismaClient({
    datasources: {
      db: {
        url,
      },
    },
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const db = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = db;
