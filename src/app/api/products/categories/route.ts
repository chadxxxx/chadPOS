import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess, isAdminOrOwner } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);

  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { products: true } },
    },
  });

  return apiSuccess(categories);
}

export async function PUT(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isAdminOrOwner(sessionData.user)) return apiError('Forbidden. Owner or Admin only.', 403);

  try {
    const body = await req.json();
    const { id, name } = body;

    if (!id) return apiError('Category ID is required.');
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return apiError('Category name is required.');
    }

    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) return apiError('Category not found.', 404);

    // Check for duplicate name (excluding self)
    const dup = await db.category.findFirst({
      where: { name: name.trim(), id: { not: id } },
    });
    if (dup) return apiError('A category with this name already exists.');

    const category = await db.category.update({
      where: { id },
      data: { name: name.trim() },
    });

    return apiSuccess(category);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update category.';
    return apiError(message);
  }
}

export async function POST(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isAdminOrOwner(sessionData.user)) return apiError('Forbidden. Owner or Admin only.', 403);

  try {
    const body = await req.json();
    const { name, sortOrder } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return apiError('Category name is required.');
    }

    const existing = await db.category.findUnique({ where: { name: name.trim() } });
    if (existing) return apiError('A category with this name already exists.');

    const category = await db.category.create({
      data: {
        name: name.trim(),
        sortOrder: parseInt(sortOrder) || 0,
      },
    });

    return apiSuccess(category, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create category.';
    return apiError(message);
  }
}

export async function DELETE(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isAdminOrOwner(sessionData.user)) return apiError('Forbidden. Owner or Admin only.', 403);

  try {
    const body = await req.json();
    const { id } = body;

    if (!id) return apiError('Category ID is required.');

    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) return apiError('Category not found.', 404);

    if (!existing.isActive) return apiError('Category is already deactivated.');

    const category = await db.category.update({
      where: { id },
      data: { isActive: false },
    });

    return apiSuccess(category);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to deactivate category.';
    return apiError(message);
  }
}
