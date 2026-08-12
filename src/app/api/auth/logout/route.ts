import { db } from '@/lib/db';
import { getSessionFromRequest, createAuditLog, apiSuccess } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const auth = await getSessionFromRequest(req);
  if (auth) {
    await createAuditLog({ userId: auth.user.id, username: auth.user.username, action: 'LOGOUT' });
    await db.session.deleteMany({ where: { userId: auth.user.id, token: auth.session.token } });
  }
  return apiSuccess({ loggedOut: true });
}