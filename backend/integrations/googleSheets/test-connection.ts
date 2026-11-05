#!/usr/bin/env node

/**
 * GOOGLE SHEETS CONNECTION SMOKE TEST
 *
 * Verifies that the service account credentials are valid and the target
 * spreadsheet is accessible. Reads sheet metadata and prints the title.
 *
 * Usage:
 *   SPREADSHEET_ID=<your-sheet-id> npx tsx integrations/googleSheets/test-connection.ts
 *
 * The spreadsheet ID is the long string in the Sheet URL:
 *   https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — base64-encoded service account JSON key
 *   SPREADSHEET_ID               — ID of the sheet to connect to (or pass as arg)
 */

import 'dotenv/config';
import { getSheetsClient } from './client';

const spreadsheetId = process.argv[2] ?? process.env.SPREADSHEET_ID;

if (!spreadsheetId) {
  console.error('ERROR: Provide a spreadsheet ID as an argument or set SPREADSHEET_ID');
  console.error('Usage: SPREADSHEET_ID=xxx npx tsx integrations/googleSheets/test-connection.ts');
  process.exit(1);
}

async function main() {
  console.log('Connecting to Google Sheets...');

  const sheets = getSheetsClient();

  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'spreadsheetId,properties.title,sheets.properties.title',
  });

  const { spreadsheetId: id, properties, sheets: sheetTabs } = res.data;

  console.log(`\n✓ Connected successfully\n`);
  console.log(`  Spreadsheet ID : ${id}`);
  console.log(`  Title          : ${properties?.title}`);
  console.log(`  Tabs           : ${sheetTabs?.map(s => s.properties?.title).join(', ')}`);
  console.log('');
}

main().catch((err: unknown) => {
  console.error('Connection failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
