/**
 * Google Sheets Backup Sync
 *
 * Appends sale/utang rows to a Google Sheet as a real-time backup.
 * Uses a Google Service Account for authentication (no user OAuth needed).
 *
 * Required env vars:
 *   GOOGLE_SHEET_ID            — The spreadsheet ID from the URL
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL — The service account email
 *   GOOGLE_PRIVATE_KEY         — The service account private key (PEM)
 *
 * The sheet should have these headers in row 1:
 *   Type | Txn # | Date | Customer | Items | Subtotal | Discount | Total |
 *   Payment Method | Amount Paid | Change | Status | Cashier | Synced At
 */

import { google } from 'googleapis';

/* ------------------------------------------------------------------ */
/*  Lazy auth — create one JWT client and reuse it                    */
/* ------------------------------------------------------------------ */

let authClient: any = null;

function getAuthClient() {
  if (authClient) return authClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !key) {
    console.warn('[GoogleSheets] Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY — sync disabled.');
    return null;
  }

  authClient = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return authClient;
}

/* ------------------------------------------------------------------ */
/*  Append a row to the spreadsheet                                    */
/* ------------------------------------------------------------------ */

interface SyncSaleRow {
  type: 'SALE' | 'UTANG' | 'UTANG_PAID';
  transactionNumber: string;
  date: string;
  customerName: string;
  itemsSummary: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentAmount: number;
  changeAmount: number;
  status: string;
  cashier: string;
}

/**
 * Append a single row to the Google Sheet.
 * Runs in the background — errors are logged but never throw,
 * so the POS flow is never blocked by a Sheets sync failure.
 */
export async function syncSaleToGoogleSheet(row: SyncSaleRow): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    // Sync not configured — silently skip
    return;
  }

  const auth = getAuthClient();
  if (!auth) return;

  const values = [[
    row.type,
    row.transactionNumber,
    row.date,
    row.customerName || '',
    row.itemsSummary,
    row.subtotal,
    row.discount,
    row.total,
    row.paymentMethod,
    row.paymentAmount,
    row.changeAmount,
    row.status,
    row.cashier,
    new Date().toISOString(),
  ]];

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1',          // Appends after the last row in Sheet1
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    console.log(`[GoogleSheets] Synced ${row.type} txn ${row.transactionNumber}`);
  } catch (err: any) {
    // Log but don't throw — Sheets backup failure must never break the sale
    console.error(`[GoogleSheets] Sync FAILED for ${row.type} txn ${row.transactionNumber}:`, err?.message || err);
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers to build row data from sale records                        */
/* ------------------------------------------------------------------ */

export function buildSaleRow(sale: any, items: any[], cashierName: string): SyncSaleRow {
  const isUtang = sale.paymentMethod === 'UTANG';
  const itemsSummary = items
    .map((i: any) => `${i.productName} x${i.quantity}`)
    .join('; ');

  return {
    type: isUtang ? 'UTANG' : 'SALE',
    transactionNumber: sale.transactionNumber,
    date: sale.createdAt ? new Date(sale.createdAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
    customerName: sale.customerName || '',
    itemsSummary,
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    paymentMethod: sale.paymentMethod,
    paymentAmount: sale.paymentAmount,
    changeAmount: sale.changeAmount,
    status: sale.status,
    cashier: cashierName,
  };
}

export function buildUtangPaidRow(sale: any, paidBy: string): SyncSaleRow {
  return {
    type: 'UTANG_PAID',
    transactionNumber: sale.transactionNumber,
    date: new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
    customerName: sale.customerName || '',
    itemsSummary: '(utang payment collected)',
    subtotal: 0,
    discount: 0,
    total: sale.total,
    paymentMethod: 'UTANG_PAYMENT',
    paymentAmount: sale.total,
    changeAmount: 0,
    status: 'COMPLETED',
    cashier: paidBy,
  };
}
