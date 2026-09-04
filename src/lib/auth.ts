import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'medrefill-pharmacy-jwt-secret-key-32-chars-min!!'
);

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  role: string;
}

export async function signToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
    };
  } catch (err) {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('session_token')?.value;
    if (!token) return null;
    return await verifyToken(token);
  } catch {
    return null;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
