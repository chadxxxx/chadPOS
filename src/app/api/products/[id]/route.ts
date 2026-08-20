import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess, isAdminOrOwner, createAuditLog } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);

  const { id } = await params;

  const product = await db.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
      priceHistory: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!product) return apiError('Product not found.', 404);

  return apiSuccess(product);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isAdminOrOwner(sessionData.user)) return apiError('Forbidden. Owner or Admin only.', 403);

  const { id } = await params;

  try {
    const body = await req.json();
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) return apiError('Product not found.', 404);

    const {
      name, barcode, sku, brand, categoryId, supplierId,
      costPrice, sellingPrice, minStockLevel, unit, imageUrl, status,
    } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = typeof name === 'string' ? name.trim() : name;
    if (sku !== undefined) updateData.sku = sku || null;
    if (brand !== undefined) updateData.brand = brand || null;
    if (categoryId !== undefined) updateData.categoryId = categoryId || null;
    if (supplierId !== undefined) updateData.supplierId = supplierId || null;
    if (minStockLevel !== undefined) updateData.minStockLevel = parseInt(minStockLevel) || 5;
    if (unit !== undefined) updateData.unit = unit || 'pc';
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl || null;
    if (status !== undefined) updateData.status = status;

    if (barcode !== undefined) {
      if (barcode && barcode !== existing.barcode) {
        const dup = await db.product.findFirst({ where: { barcode, id: { not: id } } });
        if (dup) return apiError('A product with this barcode already exists.');
      }
      updateData.barcode = barcode || null;
      // Keep SKU in sync with barcode
      updateData.sku = barcode || null;
    }

    let newCostPrice = existing.costPrice;
    let newSellingPrice = existing.sellingPrice;

    if (costPrice !== undefined) {
      newCostPrice = parseFloat(costPrice);
      updateData.costPrice = newCostPrice;
    }
    if (sellingPrice !== undefined) {
      newSellingPrice = parseFloat(sellingPrice);
      updateData.sellingPrice = newSellingPrice;
    }

    // Track price changes
    const costChanged = newCostPrice !== existing.costPrice;
    const sellChanged = newSellingPrice !== existing.sellingPrice;

    if (costChanged || sellChanged) {
      await db.priceHistory.create({
        data: {
          productId: id,
          previousCost: existing.costPrice,
          newCost: newCostPrice,
          previousSell: existing.sellingPrice,
          newSell: newSellingPrice,
          reason: 'Manual price update',
          userId: sessionData.user.id,
        },
      });
    }

    const product = await db.product.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    await createAuditLog({
      userId: sessionData.user.id,
      username: sessionData.user.username,
      action: 'UPDATE_PRODUCT',
      recordType: 'Product',
      recordId: id,
      previousValue: JSON.stringify({
        name: existing.name,
        costPrice: existing.costPrice,
        sellingPrice: existing.sellingPrice,
      }),
      newValue: JSON.stringify({
        name: product.name,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
      }),
      ipAddress,
    });

    return apiSuccess(product);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update product.';
    return apiError(message);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isAdminOrOwner(sessionData.user)) return apiError('Forbidden. Owner or Admin only.', 403);

  const { id } = await params;

  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) return apiError('Product not found.', 404);

  if (existing.status === 'ARCHIVED') {
    return apiError('Product is already archived.');
  }

  const product = await db.product.update({
    where: { id },
    data: { status: 'ARCHIVED' },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
  });

  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  await createAuditLog({
    userId: sessionData.user.id,
    username: sessionData.user.username,
    action: 'ARCHIVE_PRODUCT',
    recordType: 'Product',
    recordId: id,
    previousValue: JSON.stringify({ name: existing.name, status: existing.status }),
    newValue: JSON.stringify({ name: product.name, status: product.status }),
    ipAddress,
  });

  return apiSuccess(product);
}
