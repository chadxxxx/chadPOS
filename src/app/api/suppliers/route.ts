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
  const search = searchParams.get('search') || '';

  const where: Prisma.SupplierWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { contactPerson: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  const skip = (page - 1) * limit;

  const [suppliers, total] = await Promise.all([
    db.supplier.findMany({
      where,
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    db.supplier.count({ where }),
  ]);

  return apiSuccess({
    data: suppliers,
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
    const { name, contactPerson, phone, address, notes } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return apiError('Supplier name is required.');
    }

    const supplier = await db.supplier.create({
      data: {
        name: name.trim(),
        contactPerson: contactPerson || null,
        phone: phone || null,
        address: address || null,
        notes: notes || null,
      },
    });

    return apiSuccess(supplier, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create supplier.';
    return apiError(message);
  }
}
