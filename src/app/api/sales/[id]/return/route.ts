import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess, createAuditLog, isOwner, isAdminOrOwner } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getSessionFromRequest(req);
  if (!auth) return apiError('Not authenticated.', 401);
  if (!isOwner(auth.user) && !isAdminOrOwner(auth.user)) return apiError('Not authorized.', 403);

  const { id } = await params;
  const { items, reason } = await req.json();
  if (!items?.length || !reason) return apiError('Items and reason are required.');

  const sale = await db.sale.findUnique({ where: { id }, include: { items: true } });
  if (!sale) return apiError('Transaction not found.', 404);

  await db.$transaction(async (tx) => {
    for (const ret of items) {
      const saleItem = sale.items.find((i: any) => i.id === ret.saleItemId);
      if (!saleItem) continue;

      await tx.return.create({
        data: { saleId: id, productId: saleItem.productId, productName: saleItem.productName, quantity: ret.quantity, amount: saleItem.unitPrice * ret.quantity, reason, processedBy: auth.user.id },
      });

      const product = await tx.product.findUniqueOrThrow({ where: { id: saleItem.productId } });
      const newQty = product.currentQuantity + ret.quantity;
      await tx.product.update({ where: { id: saleItem.productId }, data: { currentQuantity: newQty } });
      await tx.inventoryMovement.create({
        data: { productId: saleItem.productId, previousQty: product.currentQuantity, quantityChanged: ret.quantity, newQty, type: 'RETURN', reason, referenceId: id, userId: auth.user.id },
      });
    }
  });

  await createAuditLog({ userId: auth.user.id, username: auth.user.username, action: 'RETURN_PROCESSED', recordType: 'Sale', recordId: id, newValue: JSON.stringify({ itemCount: items.length, reason }) });
  return apiSuccess({ returned: true });
}
