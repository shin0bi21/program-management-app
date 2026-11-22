#!/usr/bin/env node

/**
 * GOOGLE SHEETS CONNECTION SMOKE TEST
 *
 * Verifies that the service account credentials are valid and the target
 * spreadsheet is accessible. Reads sheet metadata and prints the title.
 *
 * Flow: validate target/help, read spreadsheet metadata, then print the result.
 * See usage() for commands and required credentials.
 */

import 'dotenv/config';
import { errorForLog } from '../../src/errors';
import { getSheetsClient } from './client';

/**
 * Validates the target, reads spreadsheet metadata, and prints the connection result.
 * @example main() // with --help, prints usage without contacting Google Sheets.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['-h', '--help'].includes(args[0])) {
    console.log(usage());
    return;
  }
  if (args.length > 1 || args[0]?.startsWith('-')) throw new Error(usage());

  const spreadsheetId = args[0] ?? process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error('Provide a spreadsheet ID as an argument or set SPREADSHEET_ID.');

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

/**
 * Describes the metadata-only connection check and required credentials.
 * @example usage().includes('SPREADSHEET_ID') // true
 */
function usage(): string {
  return `Usage: npx tsx integrations/googleSheets/test-connection.ts [SPREADSHEET_ID]

The positional ID overrides SPREADSHEET_ID from the environment.
Requires GOOGLE_SERVICE_ACCOUNT_JSON (base64-encoded service account JSON).
Reads spreadsheet metadata and prints its title and tabs; does not change cells.
  -h, --help  Show help without contacting Google Sheets.`;
}

if (require.main === module) {
  main().catch((error: Error) => {
    console.error('[GoogleSheets] Error checking connection', errorForLog(error));
    process.exitCode = 1;
  });
}
