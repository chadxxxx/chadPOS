import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  getSessionFromRequest,
  apiError,
  apiSuccess,
  isAdminOrOwner,
  createAuditLog,
} from '@/lib/auth';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');

  if (date) {
    // Get closing for a specific date
    const closing = await db.dailyClosing.findUnique({
      where: { date },
      include: {
        closedByUser: { select: { id: true, username: true, displayName: true } },
      },
    });

    if (!closing) {
      return apiSuccess(null);
    }
    return apiSuccess(closing);
  }

  // List closings with pagination
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20')));

  const skip = (page - 1) * limit;

  const [closings, total] = await Promise.all([
    db.dailyClosing.findMany({
      include: {
        closedByUser: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    db.dailyClosing.count(),
  ]);

  return apiSuccess({
    data: closings,
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
    const { date, startingCash, actualCash, notes } = body;

    const closingDate = date || new Date().toISOString().split('T')[0];

    // Check if closing already exists for this date
    const existing = await db.dailyClosing.findUnique({ where: { date: closingDate } });
    if (existing) return apiError('Daily closing already exists for this date.');

    // Calculate sales for the day
    const dayStart = new Date(closingDate + 'T00:00:00.000Z');
    const dayEnd = new Date(closingDate + 'T23:59:59.999Z');

    const salesWhere: Prisma.SaleWhereInput = {
      createdAt: { gte: dayStart, lte: dayEnd },
      status: 'COMPLETED',
    };

    const salesAgg = await db.sale.aggregate({
      where: {
        ...salesWhere,
        paymentMethod: 'CASH',
      },
      _sum: { total: true },
    });

    const digitalAgg = await db.sale.aggregate({
      where: {
        ...salesWhere,
        paymentMethod: { not: 'CASH' },
      },
      _sum: { total: true },
    });

    const cashSales = salesAgg._sum.total || 0;
    const digitalSales = digitalAgg._sum.total || 0;

    // Calculate total expenses for the day
    const expensesAgg = await db.expense.aggregate({
      where: {
        date: { gte: dayStart, lte: dayEnd },
      },
      _sum: { amount: true },
    });

    const totalExpenses = expensesAgg._sum.amount || 0;
    const startCash = parseFloat(startingCash) || 0;
    const expectedCash = startCash + cashSales - totalExpenses;
    const actCash = actualCash !== undefined && actualCash !== null ? parseFloat(actualCash) : null;
    const difference = actCash !== null ? actCash - expectedCash : null;

    const closing = await db.dailyClosing.create({
      data: {
        date: closingDate,
        startingCash: startCash,
        cashSales,
        digitalSales,
        totalExpenses,
        expectedCash,
        actualCash: actCash,
        difference,
        notes: notes || null,
        closedBy: sessionData.user.id,
      },
      include: {
        closedByUser: { select: { id: true, username: true, displayName: true } },
      },
    });

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    await createAuditLog({
      userId: sessionData.user.id,
      username: sessionData.user.username,
      action: 'DAILY_CLOSING',
      recordType: 'DailyClosing',
      recordId: closing.id,
      newValue: JSON.stringify({
        date: closingDate,
        cashSales,
        digitalSales,
        expectedCash,
        actualCash: actCash,
        difference,
      }),
      ipAddress,
    });

    return apiSuccess(closing, 201);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create daily closing.';
    return apiError(message);
  }
}
