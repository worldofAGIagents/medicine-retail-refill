import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

function getDatabaseUrl(): string {
  // If user provided an external PostgreSQL / MySQL DATABASE_URL
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
    return process.env.DATABASE_URL;
  }

  // On Vercel Serverless Lambdas:
  // /var/task is read-only, so SQLite throws Error Code 14 (SQLITE_CANTOPEN)
  // because it cannot create WAL/journal files. /tmp is the only writable directory.
  if (process.env.VERCEL) {
    const tmpDbPath = '/tmp/dev.db';

    const candidates = [
      path.join(process.cwd(), 'prisma', 'dev.db'),
      path.join('/var/task', 'prisma', 'dev.db'),
      path.join(process.cwd(), 'dev.db'),
    ];

    for (const src of candidates) {
      if (fs.existsSync(src)) {
        try {
          const shouldCopy = !fs.existsSync(tmpDbPath) || fs.statSync(src).size !== fs.statSync(tmpDbPath).size;
          if (shouldCopy) {
            fs.copyFileSync(src, tmpDbPath);
          }
          break;
        } catch (e) {
          console.error('Failed to copy database to /tmp:', e);
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
