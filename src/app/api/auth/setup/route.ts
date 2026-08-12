import { db } from '@/lib/db';
import { hashPassword, createSession, apiError, apiSuccess, createAuditLog } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET() {
  const ownerCount = await db.user.count({ where: { role: 'OWNER' } });
  return apiSuccess({ isSetupComplete: ownerCount > 0 });
}

export async function POST(req: NextRequest) {
  try {
    const ownerCount = await db.user.count({ where: { role: 'OWNER' } });
    if (ownerCount > 0) return apiError('Setup already completed.', 400);

    const { username, displayName, password, recoveryEmail } = await req.json();
    if (!username || !displayName || !password) return apiError('All fields are required.');
    if (password.length < 8) return apiError('Password must be at least 8 characters.');
    if (username.length < 3) return apiError('Username must be at least 3 characters.');

    const existing = await db.user.findUnique({ where: { username } });
    if (existing) return apiError('Username is already taken.');

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { username, displayName, passwordHash, role: 'OWNER', recoveryEmail: recoveryEmail || null },
    });

    // Seed default categories
    const defaultCategories = ['Beverages', 'Snacks', 'Canned Goods', 'Instant Noodles', 'Rice', 'Condiments', 'Personal Care', 'Household', 'Frozen Goods', 'Other'];
    await db.category.createMany({
      data: defaultCategories.map((name, i) => ({ name, sortOrder: i })),
    });

    // Seed default payment methods
    await db.paymentMethod.createMany({
      data: [{ name: 'Cash', sortOrder: 0 }, { name: 'GCash', sortOrder: 1 }],
    });

    // Seed default store settings
    await db.storeSetting.createMany({
      data: [
        { key: 'storeName', value: 'My Sari-Sari Store' },
        { key: 'storeAddress', value: '' },
        { key: 'storeContact', value: '' },
        { key: 'currency', value: 'PHP' },
        { key: 'receiptFooter', value: 'Thank you for your purchase!' },
      ],
    });

    const session = await createSession(user.id, req);
    await createAuditLog({ userId: user.id, username: user.username, action: 'OWNER_SETUP', recordType: 'User', recordId: user.id });

    return apiSuccess({
      token: session.token,
      user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, status: user.status },
    });
  } catch (err: any) {
    return apiError('Setup failed. Please try again.', 500);
  }
}