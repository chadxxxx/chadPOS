import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  getSessionFromRequest,
  apiError,
  apiSuccess,
  isAdminOrOwner,
  isOwner,
  createAuditLog,
} from '@/lib/auth';

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
    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) return apiError('Expense not found.', 404);

    // Non-owners can only edit their own expenses
    if (!isOwner(sessionData.user) && existing.userId !== sessionData.user.id) {
      return apiError('You can only edit your own expenses.', 403);
    }

    const { description, category, amount, date, notes } = body;

    const updateData: Record<string, unknown> = {};
    if (description !== undefined) updateData.description = typeof description === 'string' ? description.trim() : description;
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (date !== undefined) updateData.date = new Date(date);
    if (notes !== undefined) updateData.notes = notes || null;

    const expense = await db.expense.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, username: true, displayName: true } },
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    await createAuditLog({
      userId: sessionData.user.id,
      username: sessionData.user.username,
      action: 'UPDATE_EXPENSE',
      recordType: 'Expense',
      recordId: id,
      previousValue: JSON.stringify({ description: existing.description, amount: existing.amount }),
      newValue: JSON.stringify({ description: expense.description, amount: expense.amount }),
      ipAddress,
    });

    return apiSuccess(expense);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update expense.';
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

  const existing = await db.expense.findUnique({ where: { id } });
  if (!existing) return apiError('Expense not found.', 404);

  // Non-owners can only delete their own expenses
  if (!isOwner(sessionData.user) && existing.userId !== sessionData.user.id) {
    return apiError('You can only delete your own expenses.', 403);
  }

  await db.expense.delete({ where: { id } });

  const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  await createAuditLog({
    userId: sessionData.user.id,
    username: sessionData.user.username,
    action: 'DELETE_EXPENSE',
    recordType: 'Expense',
    recordId: id,
    previousValue: JSON.stringify({ description: existing.description, amount: existing.amount }),
    ipAddress,
  });

  return apiSuccess({ deleted: true });
}
