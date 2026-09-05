import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const auth = await getSessionFromRequest(req);
  if (!auth) return apiError('Not authenticated.', 401);

  const url = new URL(req.url);
  const customerName = url.searchParams.get('customerName');
  const statusFilter = url.searchParams.get('status') || 'pending'; // pending | all

  if (!customerName?.trim()) return apiError('Customer name is required.', 400);

  const where: any = {
    paymentMethod: 'UTANG',
    customerName: customerName.trim(),
  };

  if (statusFilter === 'pending') {
    where.status = 'CREDIT';
  }

  const sales = await db.sale.findMany({
    where,
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      cashier: { select: { displayName: true } },
      utangPaidByUser: { select: { id: true, displayName: true } },
    },
    orderBy: { date: 'asc' },
  });

  if (sales.length === 0) {
    return apiError('No utang transactions found for this customer.', 404);
  }

  // Build consolidated transactions list with items and dates
  const transactions = sales.map((sale) => ({
    id: sale.id,
    transactionNumber: sale.transactionNumber,
    date: sale.date.toISOString(),
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    status: sale.status,
    items: sale.items.map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      date: item.createdAt.toISOString(),
    })),
    utangPaidAt: sale.utangPaidAt?.toISOString() || null,
    utangPaidByUser: sale.utangPaidByUser
      ? { id: sale.utangPaidByUser.id, displayName: sale.utangPaidByUser.displayName }
      : null,
  }));

  const grandTotal = transactions.reduce((sum, t) => sum + t.total, 0);
  const totalItems = transactions.reduce((sum, t) => sum + t.items.reduce((s, i) => s + i.quantity, 0), 0);

  // Store info for invoice header
  const storeSettings = await db.storeSetting.findMany({
    where: { key: { in: ['storeName', 'storeAddress', 'storeContact'] } },
  });
  const storeInfo: Record<string, string> = {};
  for (const s of storeSettings) storeInfo[s.key] = s.value;

  return apiSuccess({
    customerName: customerName.trim(),
    transactions,
    grandTotal,
    totalItems,
    transactionCount: transactions.length,
    storeInfo,
  });
}
