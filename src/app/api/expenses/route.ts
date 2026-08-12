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
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const category = searchParams.get('category');

  const where: Prisma.ExpenseWhereInput = {};

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }

  if (category) where.category = category;

  const skip = (page - 1) * limit;

  const [expenses, total] = await Promise.all([
    db.expense.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    db.expense.count({ where }),
  ]);

  return apiSuccess({
    data: expenses,
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
    const { description, category, amount, date, notes } = body;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return apiError('Description is required.');
    }
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      return apiError('Category is required.');
    }
    if (amount === undefined || amount === null || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return apiError('Valid positive amount is required.');
    }

    const expense = await db.expense.create({
      data: {
        description: description.trim(),
        category: category.trim(),
        amount: parseFloat(amount),
        date: date ? new Date(date) : new Date(),
        notes: notes || null,
        userId: sessionData.user.id,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
      },
    });

    return apiSuccess(expense, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create expense.';
    return apiError(message);
  }
}
