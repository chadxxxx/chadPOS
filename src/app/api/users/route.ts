import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  getSessionFromRequest,
  apiError,
  apiSuccess,
  isOwner,
  hashPassword,
  createAuditLog,
} from '@/lib/auth';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isOwner(sessionData.user)) return apiError('Forbidden. Owner only.', 403);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20')));

  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    db.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        status: true,
        recoveryEmail: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.user.count(),
  ]);

  return apiSuccess({
    data: users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isOwner(sessionData.user)) return apiError('Forbidden. Owner only.', 403);

  try {
    const body = await req.json();
    const { username, displayName, password, role } = body;

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return apiError('Username is required.');
    }
    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
      return apiError('Display name is required.');
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return apiError('Password must be at least 6 characters.');
    }

    const validRoles = ['OWNER', 'ADMIN', 'CASHIER'];
    if (role && !validRoles.includes(role)) {
      return apiError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Check for duplicate username
    const existing = await db.user.findUnique({ where: { username: username.trim() } });
    if (existing) return apiError('A user with this username already exists.');

    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: {
        username: username.trim(),
        displayName: displayName.trim(),
        passwordHash,
        role: role || 'CASHIER',
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    await createAuditLog({
      userId: sessionData.user.id,
      username: sessionData.user.username,
      action: 'CREATE_USER',
      recordType: 'User',
      recordId: user.id,
      newValue: JSON.stringify({ username: user.username, role: user.role }),
      ipAddress,
    });

    return apiSuccess(user, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create user.';
    return apiError(message);
  }
}
