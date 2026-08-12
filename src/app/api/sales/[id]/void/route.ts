import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess, createAuditLog, isOwner, isAdminOrOwner } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getSessionFromRequest(req);
  if (!auth) return apiError('Not authenticated.', 401);
  if (!isOwner(auth.user) && !isAdminOrOwner(auth.user)) return apiError('Not authorized.', 403);

  const { id } = await params;
  const { reason } = await req.json();
  if (!reason) return apiError('A reason is required for voiding a transaction.');

  const sale = await db.sale.findUnique({ where: { id }, include: { items: true } });
  if (!sale) return apiError('Transaction not found.', 404);
  if (sale.status === 'VOIDED') return apiError('Transaction is already voided.');

  await db.$transaction(async (tx) => {
    await tx.sale.update({
      where: { id },
      data: { status: 'VOIDED', voidReason: reason, voidedBy: auth.user.id, voidedAt: new Date() },
    });

    for (const item of sale.items) {
      const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
      const newQty = product.currentQuantity + item.quantity;
      await tx.product.update({ where: { id: item.productId }, data: { currentQuantity: newQty } });
      await tx.inventoryMovement.create({
        data: { productId: item.productId, previousQty: product.currentQuantity, quantityChanged: item.quantity, newQty, type: 'RETURN', reason: `Void: ${reason}`, referenceId: id, userId: auth.user.id },
      });
    }
  });

  await createAuditLog({ userId: auth.user.id, username: auth.user.username, action: 'TRANSACTION_VOIDED', recordType: 'Sale', recordId: id, newValue: JSON.stringify({ reason }) });
  return apiSuccess({ voided: true });
}