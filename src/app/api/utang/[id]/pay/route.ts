import { db } from '@/lib/db';
import { getSessionFromRequest, apiError, apiSuccess, isAdminOrOwner, createAuditLog } from '@/lib/auth';
import { syncSaleToGoogleSheet, buildUtangPaidRow } from '@/lib/google-sheets';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getSessionFromRequest(req);
  if (!auth) return apiError('Not authenticated.', 401);
  if (!isAdminOrOwner(auth.user)) return apiError('Only ADMIN or OWNER can mark utang as paid.', 403);

  const { id } = await params;

  const sale = await db.sale.findUnique({ where: { id } });
  if (!sale) return apiError('Transaction not found.', 404);
  if (sale.paymentMethod !== 'UTANG') return apiError('This transaction is not a utang sale.', 400);
  if (sale.status === 'COMPLETED') return apiError('This utang has already been paid.', 400);
  if (sale.status === 'VOIDED') return apiError('This transaction has been voided.', 400);

  await db.sale.update({
    where: { id },
    data: {
      status: 'COMPLETED',
      utangPaidAt: new Date(),
      utangPaidBy: auth.user.id,
    },
  });

  await createAuditLog({
    userId: auth.user.id,
    username: auth.user.username,
    action: 'UTANG_PAID',
    recordType: 'Sale',
    recordId: id,
    previousValue: JSON.stringify({ status: 'CREDIT' }),
    newValue: JSON.stringify({ status: 'COMPLETED', customerName: sale.customerName, amount: sale.total }),
    ipAddress: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
  });

  // Sync utang payment to Google Sheets in the background
  syncSaleToGoogleSheet(buildUtangPaidRow(sale, auth.user.displayName || auth.user.username));

  return apiSuccess({ paid: true });
}
