import { getSessionFromRequest, apiError, apiSuccess } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const auth = await getSessionFromRequest(req);
  if (!auth) return apiError('Not authenticated.', 401);
  return apiSuccess(auth.user);
}
