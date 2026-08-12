import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  getSessionFromRequest,
  apiError,
  apiSuccess,
  isOwner,
  hashPassword,
  generateRecoveryCodes,
  createAuditLog,
} from '@/lib/auth';

export async function GET(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isOwner(sessionData.user)) return apiError('Forbidden. Owner only.', 403);

  const user = await db.user.findUnique({
    where: { id: sessionData.user.id },
    select: { recoveryEmail: true },
  });

  if (!user) return apiError('User not found.', 404);

  const hasRecoveryEmail = !!user.recoveryEmail && user.recoveryEmail.length > 0;
  let emailMasked: string | null = null;

  if (hasRecoveryEmail && user.recoveryEmail) {
    const email = user.recoveryEmail;
    const atIndex = email.indexOf('@');
    if (atIndex > 0) {
      const localPart = email.substring(0, atIndex);
      const domain = email.substring(atIndex);
      const maskedLocal = localPart.charAt(0) + '***';
      emailMasked = `${maskedLocal}${domain}`;
    } else {
      emailMasked = email.charAt(0) + '***';
    }
  }

  return apiSuccess({ hasRecoveryEmail, emailMasked });
}

export async function POST(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isOwner(sessionData.user)) return apiError('Forbidden. Owner only.', 403);

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'use') {
    // Use a recovery code to reset password
    try {
      const body = await req.json();
      const { code, username, newPassword } = body;

      if (!code || typeof code !== 'string') return apiError('Recovery code is required.');
      if (!username || typeof username !== 'string') return apiError('Username is required.');
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return apiError('New password must be at least 6 characters.');
      }

      // Find the user by username
      const user = await db.user.findUnique({ where: { username } });
      if (!user) return apiError('User not found.', 404);

      // Find the unused recovery code
      const recoveryCode = await db.recoveryCode.findFirst({
        where: {
          code: code.trim(),
          userId: user.id,
          used: false,
        },
      });

      if (!recoveryCode) return apiError('Invalid or already used recovery code.');

      // Hash new password and update
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

      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
      await createAuditLog({
        action: 'RECOVERY_CODE_USED',
        recordType: 'User',
        recordId: user.id,
        previousValue: 'Password changed via recovery code',
        newValue: username,
        ipAddress,
      });

      return apiSuccess({ success: true, message: 'Password has been reset successfully.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to use recovery code.';
      return apiError(message);
    }
  }

  // Generate new recovery codes
  try {
    // Invalidate all existing codes
    await db.recoveryCode.deleteMany({
      where: { userId: sessionData.user.id },
    });

    const codes = generateRecoveryCodes(8);

    await db.recoveryCode.createMany({
      data: codes.map(code => ({
        code,
        userId: sessionData.user.id,
      })),
    });

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    await createAuditLog({
      userId: sessionData.user.id,
      username: sessionData.user.username,
      action: 'GENERATE_RECOVERY_CODES',
      recordType: 'RecoveryCode',
      newValue: `${codes.length} new recovery codes generated`,
      ipAddress,
    });

    // Return codes — these are only shown once
    return apiSuccess({ codes }, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate recovery codes.';
    return apiError(message);
  }
}
