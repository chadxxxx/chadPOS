import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  getSessionFromRequest,
  apiError,
  apiSuccess,
  isOwner,
  createAuditLog,
} from '@/lib/auth';

export async function GET(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);

  const { searchParams } = new URL(req.url);
  const section = searchParams.get('section');

  if (section === 'paymentMethods') {
    const methods = await db.paymentMethod.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return apiSuccess(methods);
  }

  // Get all store settings as key-value object
  const settings = await db.storeSetting.findMany();
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = s.value;
  }
  return apiSuccess(settingsMap);
}

export async function PUT(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isOwner(sessionData.user)) return apiError('Forbidden. Owner only.', 403);

  const { searchParams } = new URL(req.url);
  const section = searchParams.get('section');

  if (section === 'paymentMethods') {
    try {
      const body = await req.json();
      const { id, isActive } = body;

      if (!id) return apiError('Payment method ID is required.');
      if (typeof isActive !== 'boolean') return apiError('isActive must be a boolean.');

      const existing = await db.paymentMethod.findUnique({ where: { id } });
      if (!existing) return apiError('Payment method not found.', 404);

      const method = await db.paymentMethod.update({
        where: { id },
        data: { isActive },
      });

      return apiSuccess(method);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update payment method.';
      return apiError(message);
    }
  }

  // Update general settings
  try {
    const body = await req.json();
    const { settings } = body;

    if (!Array.isArray(settings)) return apiError('settings must be an array of {key, value}.');

    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';

    const results = [];
    for (const item of settings) {
      const { key, value } = item;
      if (!key) continue;

      const result = await db.storeSetting.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      });
      results.push(result);
    }

    await createAuditLog({
      userId: sessionData.user.id,
      username: sessionData.user.username,
      action: 'UPDATE_SETTINGS',
      recordType: 'StoreSetting',
      newValue: JSON.stringify(settings),
      ipAddress,
    });

    return apiSuccess(results);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update settings.';
    return apiError(message);
  }
}

export async function POST(req: NextRequest) {
  const sessionData = await getSessionFromRequest(req);
  if (!sessionData) return apiError('Not authenticated.', 401);
  if (!isOwner(sessionData.user)) return apiError('Forbidden. Owner only.', 403);

  const { searchParams } = new URL(req.url);
  const section = searchParams.get('section');

  if (section === 'paymentMethods') {
    try {
      const body = await req.json();
      const { name, sortOrder } = body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return apiError('Payment method name is required.');
      }

      const existing = await db.paymentMethod.findUnique({ where: { name: name.trim() } });
      if (existing) return apiError('A payment method with this name already exists.');

      const method = await db.paymentMethod.create({
        data: {
          name: name.trim(),
          sortOrder: parseInt(sortOrder) || 0,
          isActive: true,
        },
      });

      return apiSuccess(method, 201);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create payment method.';
      return apiError(message);
    }
  }

  return apiError('Invalid section. Use ?section=paymentMethods for POST.');
}
