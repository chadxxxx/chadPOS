import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);

  const { searchParams } = new URL(req.url);
  const barcode = searchParams.get('barcode');

  if (!barcode) return apiError('Barcode parameter is required.');

  const product = await db.product.findFirst({
    where: {
      barcode,
      status: 'ACTIVE',
    },
    include: {
      category: { select: { id: true, name: true } },
    },
  });

  if (!product) {
    return apiSuccess({ found: false });
  }

  return apiSuccess({ found: true, product });
}
