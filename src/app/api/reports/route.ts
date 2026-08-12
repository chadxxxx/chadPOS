import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const auth = await getSessionFromRequest(req);
  if (!auth) return apiError('Not authenticated.', 401);

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'daily';
  const dateFrom = url.searchParams.get('dateFrom') || '';
  const dateTo = url.searchParams.get('dateTo') || '';

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  let start: Date;
  let end: Date;

  if (dateFrom && dateTo) {
    start = new Date(dateFrom);
    end = new Date(dateTo + 'T23:59:59');
  } else if (type === 'today') {
    start = new Date(todayStr + 'T00:00:00');
    end = new Date(todayStr + 'T23:59:59');
  } else if (type === 'week') {
    const dayOfWeek = today.getDay() || 7;
    start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek + 1);
    start.setHours(0, 0, 0, 0);
    end = new Date(todayStr + 'T23:59:59');
  } else if (type === 'month') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(todayStr + 'T23:59:59');
  } else if (type === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const ys = y.toISOString().split('T')[0];
    start = new Date(ys + 'T00:00:00');
    end = new Date(ys + 'T23:59:59');
  } else {
    start = new Date(todayStr + 'T00:00:00');
    end = new Date(todayStr + 'T23:59:59');
  }

  // CRITICAL: Only count actual paid sales (NOT utang/credit)
  // Utang sales have paymentMethod='UTANG' - exclude them from gross sales
  const sales = await db.sale.findMany({
    where: {
      date: { gte: start, lte: end },
      status: 'COMPLETED',
      paymentMethod: { not: 'UTANG' },
    },
    include: { items: true },
  });

  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);
  const totalCost = sales.reduce((s, sale) => s + sale.items.reduce((is, i) => is + i.costPrice * i.quantity, 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const totalTransactions = sales.length;
  const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Product sales breakdown
  const productMap = new Map<string, { productId: string; name: string; quantitySold: number; revenue: number; cost: number; profit: number }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const existing = productMap.get(item.productId);
      if (existing) {
        existing.quantitySold += item.quantity;
        existing.revenue += item.totalPrice;
        existing.cost += item.costPrice * item.quantity;
        existing.profit += (item.unitPrice - item.costPrice) * item.quantity;
      } else {
        productMap.set(item.productId, {
          productId: item.productId, name: item.productName,
          quantitySold: item.quantity, revenue: item.totalPrice,
          cost: item.costPrice * item.quantity, profit: (item.unitPrice - item.costPrice) * item.quantity,
        });
      }
    }
  }
  const productSales = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);

  // Payment method breakdown
  const paymentMap = new Map<string, { method: string; count: number; amount: number }>();
  for (const sale of sales) {
    const existing = paymentMap.get(sale.paymentMethod);
    if (existing) { existing.count++; existing.amount += sale.total; }
    else paymentMap.set(sale.paymentMethod, { method: sale.paymentMethod, count: 1, amount: sale.total });
  }
  const paymentMethods = Array.from(paymentMap.values());

  return apiSuccess({
    period: { start, end, type },
    summary: { totalRevenue, totalCost, totalProfit, profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0, totalTransactions, avgTransaction },
    productSales,
    paymentMethods,
  });
}
