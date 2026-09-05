import { NextRequest } from 'next/server';
import { apiError, apiSuccess, getSessionFromRequest, isOwner } from '@/lib/auth';
import { testGoogleSheetsConnection } from '@/lib/google-sheets';

/**
 * POST /api/settings/test-google-sheets
 * Tests the Google Sheets connection using the currently saved credentials.
 * Owner only.
 */
export async function POST(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isOwner(sessionData.user)) return apiError('Forbidden. Owner only.', 403);

  const result = await testGoogleSheetsConnection();
  return apiSuccess(result);
}
