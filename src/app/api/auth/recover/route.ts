import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createAuditLog, apiError, apiSuccess } from '@/lib/auth';

/**
 * Unauthenticated endpoint for password recovery using recovery codes.
 * This is intentionally public — the recovery code itself is the secret.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, code, newPassword } = body;

    if (!username || typeof username !== 'string' || !username.trim()) {
      return apiError('Username is required.');
    }
    if (!code || typeof code !== 'string' || !code.trim()) {
      return apiError('Recovery code is required.');
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return apiError('New password must be at least 8 characters.');
    }

    // Find the user by username
    const user = await db.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });

    if (!user) {
      // Don't reveal whether the user exists
      return apiError('Invalid username or recovery code.');
    }

    if (user.status !== 'ACTIVE') {
      return apiError('This account is not active. Contact the store owner.');
    }

    // Find the unused recovery code for this user
    const recoveryCode = await db.recoveryCode.findFirst({
      where: {
        code: code.trim().toUpperCase(),
        userId: user.id,
        used: false,
      },
    });

    if (!recoveryCode) {
      return apiError('Invalid or already used recovery code.');
    }

    // Hash the new password and update in a transaction
    const passwordHash = await hashPassword(newPassword);

    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      db.recoveryCode.update({
        where: { id: recoveryCode.id },
        data: { used: true, usedAt: new Date() },
      }),
    ]);

    // Invalidate all sessions for this user so they must re-login
    await db.session.deleteMany({ where: { userId: user.id } });

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    await createAuditLog({
      userId: user.id,
      username: user.username,
      action: 'PASSWORD_RECOVERED',
      recordType: 'User',
      recordId: user.id,
      previousValue: 'Password reset via recovery code (unauthenticated)',
      newValue: user.username,
      ipAddress,
    });

    return apiSuccess({ success: true, message: 'Password has been reset. You can now sign in with your new password.' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to process recovery.';
    return apiError(message);
  }
}
