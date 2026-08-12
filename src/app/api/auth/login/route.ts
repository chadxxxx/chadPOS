import { db } from '@/lib/db';
import { verifyPassword, createSession, apiError, apiSuccess, createAuditLog } from '@/lib/auth';
import { NextRequest } from 'next/server';

// Rate limiting in-memory store
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) return apiError('Username and password are required.');

    // Rate limiting
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const attempts = loginAttempts.get(ip);
    if (attempts && attempts.count >= MAX_ATTEMPTS) {
      if (Date.now() - attempts.lastAttempt < LOCKOUT_MS) {
        return apiError('Too many login attempts. Please wait 15 minutes before trying again.', 429);
      }
      loginAttempts.delete(ip);
    }

    const user = await db.user.findUnique({ where: { username } });
    if (!user || user.status !== 'ACTIVE') {
 // Don't reveal whether user exists
      const existing = loginAttempts.get(ip) || { count: 0, lastAttempt: Date.now() };
      loginAttempts.set(ip, { count: existing.count + 1, lastAttempt: Date.now() });
      return apiError('Invalid username or password.', 401);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const existing = loginAttempts.get(ip) || { count: 0, lastAttempt: Date.now() };
      loginAttempts.set(ip, { count: existing.count + 1, lastAttempt: Date.now() });
      await createAuditLog({ userId: user.id, username: user.username, action: 'LOGIN_FAILED', ipAddress: ip });
      return apiError('Invalid username or password.', 401);
    }

    loginAttempts.delete(ip);
    const session = await createSession(user.id, req);
    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await createAuditLog({ userId: user.id, username: user.username, action: 'LOGIN_SUCCESS', ipAddress: ip });

    return apiSuccess({
      token: session.token,
      user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, status: user.status },
    });
  } catch {
    return apiError('Login failed.', 500);
  }
}
