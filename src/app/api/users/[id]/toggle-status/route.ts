import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  getSessionFromRequest,
  apiError,
  apiSuccess,
  isOwner,
  createAuditLog,
} from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isOwner(sessionData.user)) return apiError('Forbidden. Owner only.', 403);

  const { id } = await params;

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) return apiError('User not found.', 404);

  // Cannot toggle last OWNER
  if (existing.role === 'OWNER') {
    const ownerCount = await db.user.count({ where: { role: 'OWNER', status: 'ACTIVE' } });
    if (ownerCount <= 1 && existing.status === 'ACTIVE') {
      return apiError('Cannot disable the last active OWNER.');
    }
  }

  const newStatus = existing.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
  const action = newStatus === 'DISABLED' ? 'DISABLE_USER' : 'ENABLE_USER';

  const user = await db.user.update({
    where: { id },
    data: { status: newStatus },
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
    action,
    recordType: 'User',
    recordId: id,
    previousValue: JSON.stringify({ username: existing.username, status: existing.status }),
    newValue: JSON.stringify({ username: user.username, status: user.status }),
    ipAddress,
  });

  return apiSuccess(user);
}
