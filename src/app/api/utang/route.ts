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
  const filter = url.searchParams.get('filter') || 'all'; // all | pending | paid

  // Base where: all utang sales (originally UTANG payment method)
  const where: any = { paymentMethod: 'UTANG' };

  // Filter by status
  if (filter === 'pending') {
    where.status = 'CREDIT';
  } else if (filter === 'paid') {
    where.status = 'COMPLETED';
  }
  // 'all' shows both CREDIT and COMPLETED utang sales

  // Search by customer name
  if (search) {
    where.customerName = { contains: search };
  }

  const [sales, total] = await Promise.all([
    db.sale.findMany({
      where,
      include: {
        items: true,
        cashier: { select: { id: true, displayName: true } },
        utangPaidByUser: { select: { id: true, displayName: true } },
      },
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.sale.count({ where }),
  ]);

  // Compute summary stats
  const [pendingTotal, collectedToday, uniqueCustomers] = await Promise.all([
    // Total pending utang
    db.sale.aggregate({
      where: { paymentMethod: 'UTANG', status: 'CREDIT' },
      _sum: { total: true },
    }),
    // Total collected today (paid today)
    db.sale.aggregate({
      where: {
        paymentMethod: 'UTANG',
        status: 'COMPLETED',
        utangPaidAt: {
          gte: new Date(new Date().toDateString()),
        },
      },
      _sum: { total: true },
    }),
    // Number of unique customers with pending utang
    db.sale.groupBy({
      by: ['customerName'],
      where: { paymentMethod: 'UTANG', status: 'CREDIT', customerName: { not: null } },
    }),
  ]);

  return apiSuccess({
    data: sales,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    summary: {
      pendingTotal: pendingTotal._sum.total || 0,
      collectedToday: collectedToday._sum.total || 0,
      uniquePendingCustomers: uniqueCustomers.length,
    },
  });
}
