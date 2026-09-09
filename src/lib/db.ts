import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// In scripts and standalone test runners where Next.js runtime is not pre-loaded,
// automatically load DATABASE_URL from .env so all tools and scripts seamlessly connect to Supabase
if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const k = trimmed.slice(0, eqIdx).trim();
            const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[k]) {
              process.env[k] = v;
            }
          }
        }
      }
    }
  } catch {}
}

const prismaClientSingleton = () => {
  let url = process.env.DATABASE_URL;
  if (url && url.includes('pooler.supabase.com') && !url.includes('sslmode=no-verify')) {
    url = url.replace('sslmode=require', 'sslmode=no-verify');
    if (!url.includes('sslmode=')) {
      url += (url.includes('?') ? '&' : '?') + 'sslmode=no-verify';
    }
  }

  return new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const db = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = db;

