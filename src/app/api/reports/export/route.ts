import { db } from '@/lib/db';
import { getSessionFromRequest, apiError } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const auth = await getSessionFromRequest(req);
  if (!auth) return apiError('Not authenticated.', 401);

  const url = new URL(req.url);
  const exportType = url.searchParams.get('type') || 'sales';
  const dateFrom = url.searchParams.get('dateFrom') || '';
  const dateTo = url.searchParams.get('dateTo') || '';

  let csv = '';

  if (exportType === 'sales') {
    const where: any = { status: 'COMPLETED' };
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo + 'T23:59:59');
    }
    const sales = await db.sale.findMany({
      where,
      include: { items: true, cashier: { select: { displayName: true } } },
      orderBy: { date: 'desc' },
    });
    csv = 'Transaction #,Date,Cashier,Items,Subtotal,Discount,Total,Payment Method,Payment,Change\n';
    for (const s of sales) {
      const itemCount = s.items.reduce((sum: number, i: any) => sum + i.quantity, 0);
      csv += `${s.transactionNumber},${s.date.toISOString()},${s.cashier.displayName},${itemCount},${s.subtotal.toFixed(2)},${s.discount.toFixed(2)},${s.total.toFixed(2)},${s.paymentMethod},${s.paymentAmount.toFixed(2)},${s.changeAmount.toFixed(2)}\n`;
    }
  } else if (exportType === 'products') {
    const products = await db.product.findMany({ orderBy: { name: 'asc' } });
    csv = 'Name,Barcode,SKU,Brand,Category,Cost Price,Selling Price,Current Stock,Min Stock,Status\n';
    for (const p of products) {
      csv += `"${p.name}",${p.barcode || ''},${p.sku || ''},${p.brand || ''},${p.categoryId || ''},${p.costPrice.toFixed(2)},${p.sellingPrice.toFixed(2)},${p.currentQuantity},${p.minStockLevel},${p.status}\n`;
    }
  } else if (exportType === 'inventory') {
    const movements = await db.inventoryMovement.findMany({
      include: { product: { select: { name: true } }, user: { select: { displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    csv = 'Date,Product,Type,Previous Qty,Changed,New Qty,User,Reason\n';
    for (const m of movements) {
      csv += `${m.createdAt.toISOString()},"${m.product.name}",${m.type},${m.previousQty},${m.quantityChanged},${m.newQty},${m.user.displayName},${m.reason || ''}\n`;
    }
  } else if (exportType === 'expenses') {
    const expenses = await db.expense.findMany({
      include: { user: { select: { displayName: true } } },
      orderBy: { date: 'desc' },
    });
    csv = 'Date,Description,Category,Amount,User,Notes\n';
    for (const e of expenses) {
      csv += `${e.date.toISOString()},"${e.description}",${e.category},${e.amount.toFixed(2)},${e.user.displayName},${e.notes || ''}\n`;
    }
  }

  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${exportType}_export.csv"` },
  });
}