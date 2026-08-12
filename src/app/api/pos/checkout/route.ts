import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess, generateTransactionNumber, createAuditLog } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const auth = await getSessionFromRequest(req);
  if (!auth) return apiError('Not authenticated.', 401);

  try {
    const { items, discount, paymentMethod, paymentAmount } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) return apiError('Cart is empty.');
    if (!paymentMethod || !paymentAmount) return apiError('Payment method and amount are required.');

    const subtotal = items.reduce((sum: number, i: any) => sum + i.price * i.quantity, 0);
    const total = Math.max(0, subtotal - (discount || 0));
    const changeAmount = Math.max(0, paymentAmount - total);

    if (paymentAmount < total) return apiError('Insufficient payment amount.');

    const txnNumber = generateTransactionNumber();

    const result = await db.$transaction(async (tx) => {
      // Create sale
      const sale = await tx.sale.create({
        data: {
          transactionNumber: txnNumber,
          subtotal,
          discount: discount || 0,
          total,
          paymentMethod,
          paymentAmount,
          changeAmount,
          cashierId: auth.user.id,
        },
      });

      for (const item of items) {
        // Create sale item with denormalized data
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            productName: item.name,
            barcode: item.barcode || null,
            quantity: item.quantity,
            unitPrice: item.price,
            costPrice: item.costPrice,
            totalPrice: item.price * item.quantity,
          },
        });

        // Atomically deduct inventory
        const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
        const newQty = product.currentQuantity - item.quantity;

        if (newQty < 0) {
          throw new Error(`Insufficient stock for ${product.name}. Only ${product.currentQuantity} available.`);
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { currentQuantity: newQty },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            previousQty: product.currentQuantity,
            quantityChanged: -item.quantity,
            newQty,
            type: 'SALE',
            referenceId: sale.id,
            userId: auth.user.id,
          },
        });
      }

      return sale;
    });

    await createAuditLog({
      userId: auth.user.id, username: auth.user.username,
      action: 'SALE_COMPLETED', recordType: 'Sale', recordId: result.id,
      newValue: JSON.stringify({ transactionNumber: txnNumber, total, itemCount: items.length }),
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
    });

    // Fetch complete sale with items
    const completeSale = await db.sale.findUnique({
      where: { id: result.id },
      include: { items: true, cashier: { select: { displayName: true } } },
    });

    return apiSuccess(completeSale);
  } catch (err: any) {
    if (err.message?.includes('Insufficient stock')) return apiError(err.message, 400);
    console.error('Checkout error:', err);
    return apiError('Checkout failed. Please try again.', 500);
  }
}