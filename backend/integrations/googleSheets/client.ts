import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';

let sheetsClient: sheets_v4.Sheets | null = null;

/**
 * Returns an authenticated Google Sheets client.
 *
 * Lazy-initialised — the client is created on first call and reused.
 * Throws if GOOGLE_SERVICE_ACCOUNT_JSON is not set in the environment.
 * Throws when outbound integrations are disabled locally or credentials cannot be decoded.
 *
 * Used by backend/integrations/googleSheets tooling; not part of the live API server.
 * @returns The cached client, creating it from the environment on first use.
 * @example const sheets = getSheetsClient();
 */
export function getSheetsClient(): sheets_v4.Sheets {
  if (process.env.NODE_ENV !== 'production' && process.env.DISABLE_OUTBOUND === 'true') {
    throw new Error('Outbound integrations are disabled for this local environment');
  }
  if (sheetsClient) return sheetsClient;

  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!encoded) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is not set. ' +
      'See docs/backend/integrations/google-sheets.md for setup instructions.'
    );
  }

  let credentials: object;
  try {
    credentials = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'));
  } catch {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON could not be decoded. ' +
      'Ensure it is a valid base64-encoded service account JSON key.'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

/**
 * Clears the cached client so the next call reads credentials from the environment.
 * @returns Nothing; subsequent calls to getSheetsClient create a new client.
 * @example resetSheetsClient();
 */
export function resetSheetsClient(): void {
  sheetsClient = null;
}
