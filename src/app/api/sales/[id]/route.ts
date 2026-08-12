import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess, createAuditLog } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getSessionFromRequest(req);
  if (!auth) return apiError('Not authenticated.', 401);
  const { id } = await params;
  const sale = await db.sale.findUnique({
    where: { id },
    include: { items: true, cashier: { select: { id: true, displayName: true } }, returns: true },
  });
  if (!sale) return apiError('Transaction not found.', 404);
  return apiSuccess(sale);
}
