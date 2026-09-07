import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession, hashPassword, comparePassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getSession();
    let user = null;

    if (session?.userId) {
      user = await db.user.findUnique({
        where: { id: session.userId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
    }

    if (!user) {
      // Fallback to first admin user or first registered user in the shop database
      user = await db.user.findFirst({
        where: { role: 'admin' },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }) || await db.user.findFirst({
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('Failed to get profile:', error);
    return NextResponse.json({ error: 'Failed to retrieve profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    const body = await request.json();
    const { name, email, currentPassword, newPassword } = body;

    let targetUser = null;
    if (session?.userId) {
      targetUser = await db.user.findUnique({ where: { id: session.userId } });
    }

    if (!targetUser) {
      targetUser = await db.user.findFirst({ where: { role: 'admin' } }) ||
                   await db.user.findFirst();
    }

    if (!targetUser) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {};

    if (name && name.trim()) {
      updates.name = name.trim();
    }

    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      if (cleanEmail !== targetUser.email) {
        // Check if email already taken
        const existing = await db.user.findUnique({ where: { email: cleanEmail } });
        if (existing && existing.id !== targetUser.id) {
          return NextResponse.json({ error: 'Email is already in use by another user' }, { status: 409 });
        }
        updates.email = cleanEmail;
      }
    }

    // Change Password handling
    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'New password must be at least 6 characters long' }, { status: 400 });
      }

      if (currentPassword) {
        const isMatch = await comparePassword(currentPassword, targetUser.password);
        if (!isMatch) {
          return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
        }
      }

      updates.password = await hashPassword(newPassword);
    }

    const updatedUser = await db.user.update({
      where: { id: targetUser.id },
      data: updates,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Failed to update profile:', error);
    return NextResponse.json({ error: error.message || 'Failed to update profile' }, { status: 500 });
  }
}
