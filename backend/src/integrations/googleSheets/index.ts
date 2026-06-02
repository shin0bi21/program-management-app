import { getSheetsClient } from './client';
import type { ReadSheetOptions, WriteSheetOptions, AppendSheetOptions, SheetRow } from './types';

export { getSheetsClient, resetSheetsClient } from './client';
export type { SheetRow, ReadSheetOptions, WriteSheetOptions, AppendSheetOptions } from './types';

/**
 * Read a range from a sheet.
 * Returns rows as arrays of values (empty cells are omitted from trailing
 * positions per the Sheets API default).
 */
export async function readSheet({ spreadsheetId, range }: ReadSheetOptions): Promise<SheetRow[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values as SheetRow[]) ?? [];
}

/**
 * Overwrite a range in a sheet with the given values.
 * Uses RAW input — values are written exactly as provided, no formula parsing.
 */
export async function writeSheet({ spreadsheetId, range, values }: WriteSheetOptions): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

/**
 * Append rows to a sheet after the last row with data.
 * Useful for import scripts that add new records without overwriting existing ones.
 */
export async function appendToSheet({ spreadsheetId, range, values }: AppendSheetOptions): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}
