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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isOwner(sessionData.user)) return apiError('Forbidden. Owner only.', 403);

  const { id } = await params;

  try {
    const body = await req.json();
    const { newPassword } = body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return apiError('New password must be at least 6 characters.');
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) return apiError('User not found.', 404);

    const passwordHash = await hashPassword(newPassword);

    await db.user.update({
      where: { id },
      data: { passwordHash },
    });

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    await createAuditLog({
      userId: sessionData.user.id,
      username: sessionData.user.username,
      action: 'RESET_USER_PASSWORD',
      recordType: 'User',
      recordId: id,
      newValue: `Password reset for user: ${existing.username}`,
      ipAddress,
    });

    return apiSuccess({ success: true, message: 'Password has been reset successfully.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reset password.';
    return apiError(message);
  }
}
