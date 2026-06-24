import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';

let sheetsClient: sheets_v4.Sheets | null = null;

/**
 * Returns an authenticated Google Sheets client.
 *
 * Lazy-initialised — the client is created on first call and reused.
 * Throws if GOOGLE_SERVICE_ACCOUNT_JSON is not set in the environment.
 *
 * The Express server never calls this — it is only called by scripts in
 * db/scripts/ that interact with Google Sheets.
 */
export function getSheetsClient(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;

  const encoded = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!encoded) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON is not set. ' +
      'See backend/.env.example for setup instructions.'
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

/** Reset the cached client — useful in tests or when credentials change. */
export function resetSheetsClient(): void {
  sheetsClient = null;
}
