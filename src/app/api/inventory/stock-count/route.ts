import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  getSessionFromRequest,
  apiError,
  apiSuccess,
  isAdminOrOwner,
  createAuditLog,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isAdminOrOwner(sessionData.user)) return apiError('Forbidden. Owner or Admin only.', 403);

  try {
    const body = await req.json();
    const { productId, physicalQuantity, reason } = body;

    if (!productId) return apiError('Product ID is required.');
    if (physicalQuantity === undefined || physicalQuantity === null || isNaN(parseInt(physicalQuantity))) {
      return apiError('Physical quantity is required.');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return apiError('Reason is required for stock count.');
    }

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) return apiError('Product not found.', 404);

    const systemQuantity = product.currentQuantity;
    const physical = parseInt(physicalQuantity);
    const difference = physical - systemQuantity;

    // Create stock count record
    const stockCount = await db.stockCount.create({
      data: {
        productId,
        systemQuantity,
        physicalQuantity: physical,
        difference,
        reason: reason.trim(),
        userId: sessionData.user.id,
      },
    });

    // If there's a difference, adjust inventory
    if (difference !== 0) {
      const newQty = systemQuantity + difference;
      const [updatedProduct, movement] = await db.$transaction([
        db.product.update({
          where: { id: productId },
          data: { currentQuantity: newQty },
        }),
        db.inventoryMovement.create({
          data: {
            productId,
            previousQty: systemQuantity,
            quantityChanged: difference,
            newQty,
            type: 'MANUAL_ADJUSTMENT',
            reason: `Stock count adjustment: ${reason.trim()}`,
            userId: sessionData.user.id,
          },
        }),
      ]);

      const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
      await createAuditLog({
        userId: sessionData.user.id,
        username: sessionData.user.username,
        action: 'STOCK_COUNT_ADJUSTMENT',
        recordType: 'StockCount',
        recordId: stockCount.id,
        previousValue: JSON.stringify({ systemQuantity, physicalQuantity: physical }),
        newValue: JSON.stringify({ difference, newQuantity: newQty }),
        ipAddress,
      });

      return apiSuccess({ stockCount, product: updatedProduct, movement }, 201);
    }

    return apiSuccess({ stockCount, product, movement: null }, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record stock count.';
    return apiError(message);
  }
}
