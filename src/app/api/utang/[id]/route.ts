import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getSessionFromRequest(req);
  if (!auth) return apiError('Not authenticated.', 401);

  const { id } = await params;

  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      cashier: { select: { displayName: true } },
      utangPaidByUser: { select: { id: true, displayName: true } },
    },
  });

  if (!sale) return apiError('Sale not found.', 404);
  if (sale.paymentMethod !== 'UTANG') return apiError('Not a utang sale.', 400);

  // Also get store settings for the invoice header
  const storeSettings = await db.storeSetting.findMany({
    where: { key: { in: ['storeName', 'storeAddress', 'storeContact'] } },
  });
  const storeInfo: Record<string, string> = {};
  for (const s of storeSettings) storeInfo[s.key] = s.value;

  return apiSuccess({ sale, storeInfo });
}
