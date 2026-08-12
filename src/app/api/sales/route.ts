import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const auth = await getSessionFromRequest(req);
  if (!auth) return apiError('Not authenticated.', 401);

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || '';
  const paymentMethod = url.searchParams.get('paymentMethod') || '';
  const cashierId = url.searchParams.get('cashierId') || '';
  const dateFrom = url.searchParams.get('dateFrom') || '';
  const dateTo = url.searchParams.get('dateTo') || '';

  const where: any = {};
  if (search) where.transactionNumber = { contains: search };
  if (status) where.status = status;
  if (paymentMethod) where.paymentMethod = paymentMethod;
  if (cashierId) where.cashierId = cashierId;
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo + 'T23:59:59');
  }

  const [sales, total] = await Promise.all([
    db.sale.findMany({
      where,
      include: {
        items: true,
        cashier: { select: { id: true, displayName: true } },
        returns: true,
      },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.sale.count({ where }),
  ]);

  return apiSuccess({ data: sales, total, page, limit, totalPages: Math.ceil(total / limit) });
}
