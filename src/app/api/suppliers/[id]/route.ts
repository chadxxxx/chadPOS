import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  getSessionFromRequest,
  apiError,
  apiSuccess,
  isAdminOrOwner,
  createAuditLog,
} from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);

  const { id } = await params;

  const supplier = await db.supplier.findUnique({
    where: { id },
    include: {
      products: { select: { id: true, name: true, status: true } },
      _count: { select: { products: true } },
    },
  });

  if (!supplier) return apiError('Supplier not found.', 404);

  return apiSuccess(supplier);
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
    const existing = await db.supplier.findUnique({ where: { id } });
    if (!existing) return apiError('Supplier not found.', 404);

    const { name, contactPerson, phone, address, notes, status } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = typeof name === 'string' ? name.trim() : name;
    if (contactPerson !== undefined) updateData.contactPerson = contactPerson || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (address !== undefined) updateData.address = address || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (status !== undefined) updateData.status = status;

    const supplier = await db.supplier.update({
      where: { id },
      data: updateData,
    });

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    await createAuditLog({
      userId: sessionData.user.id,
      username: sessionData.user.username,
      action: 'UPDATE_SUPPLIER',
      recordType: 'Supplier',
      recordId: id,
      previousValue: JSON.stringify({ name: existing.name }),
      newValue: JSON.stringify({ name: supplier.name }),
      ipAddress,
    });

    return apiSuccess(supplier);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update supplier.';
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

  const existing = await db.supplier.findUnique({ where: { id } });
  if (!existing) return apiError('Supplier not found.', 404);

  if (existing.status === 'INACTIVE') {
    return apiError('Supplier is already inactive.');
  }

  const supplier = await db.supplier.update({
    where: { id },
    data: { status: 'INACTIVE' },
  });

  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  await createAuditLog({
    userId: sessionData.user.id,
    username: sessionData.user.username,
    action: 'ARCHIVE_SUPPLIER',
    recordType: 'Supplier',
    recordId: id,
    previousValue: JSON.stringify({ name: existing.name, status: existing.status }),
    newValue: JSON.stringify({ name: supplier.name, status: supplier.status }),
    ipAddress,
  });

  return apiSuccess(supplier);
}
