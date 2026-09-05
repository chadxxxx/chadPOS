/**
 * Google Sheets Backup Sync
 *
 * Appends sale/utang rows to a Google Sheet as a real-time backup.
 * Credentials are read from the StoreSetting table (set via Admin Settings UI),
 * falling back to env vars for backwards compatibility.
 *
 * Settings keys used:
 *   googleSheetId              — The spreadsheet ID from the URL
 *   googleServiceAccountEmail  — The service account email
 *   googlePrivateKey           — The service account private key (PEM)
 *
 * The sheet should have these headers in row 1:
 *   Type | Txn # | Date | Customer | Items | Subtotal | Discount | Total |
 *   Payment Method | Amount Paid | Change | Status | Cashier | Synced At
 */

import { google } from 'googleapis';
import { db } from '@/lib/db';

/* ------------------------------------------------------------------ */
/*  Credential resolution — DB first, then env vars                    */
/* ------------------------------------------------------------------ */

interface SheetsCredentials {
  sheetId: string;
  email: string;
  key: string;
}

/**
 * Load Google Sheets credentials from DB settings,
 * falling back to environment variables.
 * Returns null if not fully configured.
 */
export async function getSheetsCredentials(): Promise<SheetsCredentials | null> {
  try {
    const settings = await db.storeSetting.findMany({
      where: {
        key: { in: ['googleSheetId', 'googleServiceAccountEmail', 'googlePrivateKey'] },
      },
    });
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;

    const sheetId = map.googleSheetId || process.env.GOOGLE_SHEET_ID || '';
    const email = map.googleServiceAccountEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
    const key = (map.googlePrivateKey || process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    if (!sheetId || !email || !key) return null;

    return { sheetId, email, key };
  } catch {
    // DB not available (startup edge case) — try env vars only
    const sheetId = process.env.GOOGLE_SHEET_ID || '';
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
    const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!sheetId || !email || !key) return null;
    return { sheetId, email, key };
  }
}

/**
 * Check if Google Sheets sync is configured (for status display).
 * Does NOT test the actual connection — just checks if all 3 fields are set.
 */
export async function isGoogleSheetsConfigured(): Promise<boolean> {
  const creds = await getSheetsCredentials();
  return creds !== null;
}

/* ------------------------------------------------------------------ */
/*  Lazy auth — create one JWT client per credentials set              */
/* ------------------------------------------------------------------ */

let cachedAuthEmail = '';
let authClient: any = null;

async function getAuthClient(): Promise<any> {
  const creds = await getSheetsCredentials();
  if (!creds) return null;

  // Reuse client if credentials haven't changed
  if (authClient && cachedAuthEmail === creds.email) return authClient;

  authClient = new google.auth.JWT({
    email: creds.email,
    key: creds.key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  cachedAuthEmail = creds.email;

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
  const creds = await getSheetsCredentials();
  if (!creds) return; // Not configured — silently skip

  const auth = await getAuthClient();
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
      spreadsheetId: creds.sheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    });
    console.log(`[GoogleSheets] Synced ${row.type} txn ${row.transactionNumber}`);
  } catch (err: any) {
    console.error(`[GoogleSheets] Sync FAILED for ${row.type} txn ${row.transactionNumber}:`, err?.message || err);
  }
}

/* ------------------------------------------------------------------ */
/*  Test connection — used by the admin UI "Test Connection" button    */
/* ------------------------------------------------------------------ */

export interface TestConnectionResult {
  success: boolean;
  message: string;
  sheetTitle?: string;
}

/**
 * Test the Google Sheets connection by:
 * 1. Verifying all 3 credentials are set
 * 2. Authenticating with the Sheets API
 * 3. Reading the spreadsheet metadata (title)
 */
export async function testGoogleSheetsConnection(): Promise<TestConnectionResult> {
  const creds = await getSheetsCredentials();
  if (!creds) {
    return {
      success: false,
      message: 'Not configured. Please fill in all 3 fields: Sheet ID, Service Account Email, and Private Key.',
    };
  }

  try {
    const auth = new google.auth.JWT({
      email: creds.email,
      key: creds.key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.get({
      spreadsheetId: creds.sheetId,
      fields: 'properties/title',
    });

    const title = response.data.properties?.title || 'Unknown';
    return {
      success: true,
      message: `Connected successfully to "${title}"`,
      sheetTitle: title,
    };
  } catch (err: any) {
    const msg = err?.message || String(err);

    if (/invalid_grant|invalid_client/.test(msg)) {
      return { success: false, message: 'Authentication failed. Check your Service Account Email and Private Key.' };
    }
    if (/not found|404/.test(msg)) {
      return { success: false, message: 'Spreadsheet not found. Check the Sheet ID and make sure you shared the sheet with the service account email.' };
    }
    if (/permission|403/.test(msg)) {
      return { success: false, message: 'Permission denied. Share the Google Sheet with the service account email (Editor access).' };
    }

    return { success: false, message: `Connection failed: ${msg.slice(0, 200)}` };
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
