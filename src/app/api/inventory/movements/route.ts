import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess, isAdminOrOwner, createAuditLog } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20')));
  const productId = searchParams.get('productId');
  const type = searchParams.get('type');
  const userId = searchParams.get('userId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  const where: Prisma.InventoryMovementWhereInput = {};

  if (productId) where.productId = productId;
  if (type) where.type = type;
  if (userId) where.userId = userId;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const skip = (page - 1) * limit;

  const [movements, total] = await Promise.all([
    db.inventoryMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, barcode: true } },
        user: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.inventoryMovement.count({ where }),
  ]);

  return apiSuccess({
    data: movements,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isAdminOrOwner(sessionData.user)) return apiError('Forbidden. Owner or Admin only.', 403);

  try {
    const body = await req.json();
    const { productId, quantityChanged, type, reason } = body;

    if (!productId) return apiError('Product ID is required.');
    if (quantityChanged === undefined || quantityChanged === null || isNaN(parseInt(quantityChanged))) {
      return apiError('Quantity changed is required.');
    }

    const validTypes = ['RESTOCK', 'RETURN', 'DAMAGED', 'EXPIRED', 'MANUAL_ADJUSTMENT'];
    if (!type || !validTypes.includes(type)) {
      return apiError(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) return apiError('Product not found.', 404);

    const qty = parseInt(quantityChanged);
    const previousQty = product.currentQuantity;

    // For DAMAGED, EXPIRED, MANUAL_ADJUSTMENT with negative qty, subtract
    // For RESTOCK, RETURN, add
    let newQty: number;
    if (type === 'RESTOCK' || type === 'RETURN') {
      newQty = previousQty + qty;
    } else {
      // DAMAGED, EXPIRED, MANUAL_ADJUSTMENT — qty can be positive (add) or negative (subtract)
      newQty = previousQty + qty;
    }

    if (newQty < 0) {
      return apiError('Insufficient stock for this adjustment.');
    }

    // Update product quantity and create movement atomically using transaction
    const [updatedProduct, movement] = await db.$transaction([
      db.product.update({
        where: { id: productId },
        data: { currentQuantity: newQty },
      }),
      db.inventoryMovement.create({
        data: {
          productId,
          previousQty,
          quantityChanged: qty,
          newQty,
          type,
          reason: reason || null,
          userId: sessionData.user.id,
        },
      }),
    ]);

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    await createAuditLog({
      userId: sessionData.user.id,
      username: sessionData.user.username,
      action: 'INVENTORY_MOVEMENT',
      recordType: 'InventoryMovement',
      recordId: movement.id,
      previousValue: JSON.stringify({ quantity: previousQty }),
      newValue: JSON.stringify({ quantity: newQty, type, reason }),
      ipAddress,
    });

    return apiSuccess({ product: updatedProduct, movement }, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create inventory movement.';
    return apiError(message);
  }
}
