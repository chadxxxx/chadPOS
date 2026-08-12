import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  getSessionFromRequest,
  apiError,
  apiSuccess,
  isOwner,
  createAuditLog,
} from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isOwner(sessionData.user)) return apiError('Forbidden. Owner only.', 403);

  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      status: true,
      recoveryEmail: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return apiError('User not found.', 404);

  return apiSuccess(user);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isOwner(sessionData.user)) return apiError('Forbidden. Owner only.', 403);

  const { id } = await params;

  try {
    const body = await req.json();
    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) return apiError('User not found.', 404);

    const { username, displayName, role } = body;

    const updateData: Record<string, unknown> = {};

    if (username !== undefined) {
      if (typeof username !== 'string' || username.trim().length === 0) {
        return apiError('Username cannot be empty.');
      }
      const newUsername = username.trim();
      if (newUsername !== existing.username) {
        const dup = await db.user.findFirst({ where: { username: newUsername, id: { not: id } } });
        if (dup) return apiError('A user with this username already exists.');

        // Prevent renaming last OWNER
        if (existing.role === 'OWNER') {
          const ownerCount = await db.user.count({ where: { role: 'OWNER', status: 'ACTIVE' } });
          if (ownerCount <= 1) {
            return apiError('Cannot rename the last active OWNER.');
          }
        }
      }
      updateData.username = newUsername;
    }

    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || displayName.trim().length === 0) {
        return apiError('Display name cannot be empty.');
      }
      updateData.displayName = displayName.trim();
    }

    if (role !== undefined) {
      const validRoles = ['OWNER', 'ADMIN', 'CASHIER'];
      if (!validRoles.includes(role)) {
        return apiError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
      }

      // If demoting an OWNER, check if it's the last one
      if (existing.role === 'OWNER' && role !== 'OWNER') {
        const ownerCount = await db.user.count({ where: { role: 'OWNER', status: 'ACTIVE' } });
        if (ownerCount <= 1) {
          return apiError('Cannot change role of the last active OWNER.');
        }
      }
      updateData.role = role;
    }

    const user = await db.user.update({
      where: { id },
      data: updateData,
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
      action: 'UPDATE_USER',
      recordType: 'User',
      recordId: id,
      previousValue: JSON.stringify({
        username: existing.username,
        displayName: existing.displayName,
        role: existing.role,
      }),
      newValue: JSON.stringify({
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      }),
      ipAddress,
    });

    return apiSuccess(user);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update user.';
    return apiError(message);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isOwner(sessionData.user)) return apiError('Forbidden. Owner only.', 403);

  const { id } = await params;

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) return apiError('User not found.', 404);

  if (existing.status === 'DISABLED') {
    return apiError('User is already disabled.');
  }

  // Cannot disable last OWNER
  if (existing.role === 'OWNER') {
    const ownerCount = await db.user.count({ where: { role: 'OWNER', status: 'ACTIVE' } });
    if (ownerCount <= 1) {
      return apiError('Cannot deactivate the last active OWNER.');
    }
  }

  const user = await db.user.update({
    where: { id },
    data: { status: 'DISABLED' },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      status: true,
    },
  });

  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  await createAuditLog({
    userId: sessionData.user.id,
    username: sessionData.user.username,
    action: 'DISABLE_USER',
    recordType: 'User',
    recordId: id,
    previousValue: JSON.stringify({ username: existing.username, status: existing.status }),
    newValue: JSON.stringify({ username: user.username, status: user.status }),
    ipAddress,
  });

  return apiSuccess(user);
}
