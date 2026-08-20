import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess, isAdminOrOwner } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20')));
  const search = searchParams.get('search') || '';
  const categoryId = searchParams.get('categoryId');
  const supplierId = searchParams.get('supplierId');
  const status = searchParams.get('status');
  const stockStatus = searchParams.get('stockStatus');

  const where: Prisma.ProductWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { barcode: { contains: search } },
      { sku: { contains: search } },
      { brand: { contains: search } },
    ];
  }

  if (categoryId) where.categoryId = categoryId;
  if (supplierId) where.supplierId = supplierId;
  if (status) where.status = status;

  if (stockStatus === 'low') {
    where.currentQuantity = { gt: 0 };
    where.status = 'ACTIVE';
    // Prisma doesn't support comparing two fields, so we'll filter after
  } else if (stockStatus === 'out') {
    where.currentQuantity = 0;
  }

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.product.count({ where }),
  ]);

  // Filter for stockStatus 'low' in memory since Prisma SQLite can't compare fields
  let filteredProducts = products;
  let filteredTotal = total;
  if (stockStatus === 'low') {
    filteredProducts = products.filter(p => p.currentQuantity > 0 && p.currentQuantity <= p.minStockLevel);
    const allLowStock = await db.product.findMany({
      where: { ...where, status: 'ACTIVE', currentQuantity: { gt: 0 } },
      select: { id: true, minStockLevel: true, currentQuantity: true },
    });
    const lowCount = allLowStock.filter(p => p.currentQuantity <= p.minStockLevel).length;
    filteredTotal = lowCount;
  }

  return apiSuccess({
    data: filteredProducts,
    total: filteredTotal,
    page,
    limit,
    totalPages: Math.ceil(filteredTotal / limit),
  });
}

export async function POST(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isAdminOrOwner(sessionData.user)) return apiError('Forbidden. Owner or Admin only.', 403);

  try {
    const body = await req.json();
    const { name, barcode, sku, brand, categoryId, supplierId, costPrice, sellingPrice, currentQuantity, minStockLevel, unit, imageUrl } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return apiError('Product name is required.');
    }
    if (costPrice === undefined || costPrice === null || isNaN(costPrice)) {
      return apiError('Cost price is required.');
    }
    if (sellingPrice === undefined || sellingPrice === null || isNaN(sellingPrice)) {
      return apiError('Selling price is required.');
    }

    if (barcode) {
      const existing = await db.product.findFirst({ where: { barcode } });
      if (existing) return apiError('A product with this barcode already exists.');
    }

    const product = await db.product.create({
      data: {
        name: name.trim(),
        barcode: barcode || null,
        sku: barcode || null, // SKU = barcode
        brand: brand || null,
        categoryId: categoryId || null,
        supplierId: supplierId || null,
        costPrice: parseFloat(costPrice),
        sellingPrice: parseFloat(sellingPrice),
        currentQuantity: parseInt(currentQuantity) || 0,
        minStockLevel: parseInt(minStockLevel) || 5,
        unit: unit || 'pc',
        imageUrl: imageUrl || null,
      },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    return apiSuccess(product, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create product.';
    return apiError(message);
  }
}
