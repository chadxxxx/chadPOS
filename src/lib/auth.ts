import bcrypt from 'bcryptjs';
import { db } from './db';
import crypto from 'crypto';

const SESSION_DURATION_DAYS = 7;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateRecoveryCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();
    codes.push(`${part1}-${part2}-${part3}`);
  }
  return codes;
}

export async function createSession(userId: string, req?: Request) {
  const token = generateSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

  let device = 'Unknown';
  let browser = 'Unknown';
  let ipAddress = '';

  if (req) {
    ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    const ua = req.headers.get('user-agent') || '';
    if (ua.includes('Mobile') || ua.includes('Android')) device = 'Mobile';
    else if (ua.includes('Tablet') || ua.includes('iPad')) device = 'Tablet';
    else device = 'Desktop';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else browser = 'Other';
  }

  const session = await db.session.create({
    data: { token, userId, device, browser, ipAddress, expiresAt },
  });

  return session;
}

export async function validateSession(token: string | null) {
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, username: true, displayName: true, role: true, status: true } } },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } });
    return null;
  }
  if (session.user.status !== 'ACTIVE') return null;

  await db.session.update({
    where: { id: session.id },
    data: { lastActivity: new Date() },
  });

  return { session, user: session.user };
}

export async function getSessionFromRequest(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || null;
  return validateSession(token);
}

export function hasRole(user: { role: string }, ...roles: string[]) {
  return roles.includes(user.role);
}

export function isOwner(user: { role: string }) {
  return user.role === 'OWNER';
}

export function isAdminOrOwner(user: { role: string }) {
  return user.role === 'OWNER' || user.role === 'ADMIN';
}

export function generateTransactionNumber(): string {
  const now = new Date();
  const dateStr = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `POS-${dateStr}-${rand}`;
}

export function formatCurrency(amount: number): string {
  return `\u20B1${amount.toFixed(2)}`;
}

export async function createAuditLog(data: {
  userId?: string;
  username?: string;
  action: string;
  recordType?: string;
  recordId?: string;
  previousValue?: string;
  newValue?: string;
  ipAddress?: string;
}) {
  return db.auditLog.create({ data });
}

export function apiError(message: string, status: number = 400) {
  return Response.json({ error: message }, { status });
}

export function apiSuccess(data: unknown, status: number = 200) {
  return Response.json({ data }, { status });
}