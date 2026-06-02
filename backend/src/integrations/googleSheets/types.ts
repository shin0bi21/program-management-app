export type SheetRow = (string | number | boolean | null)[];

export interface ReadSheetOptions {
  spreadsheetId: string;
  range: string; // A1 notation, e.g. "Sheet1!A1:Z"
}

export interface WriteSheetOptions {
  spreadsheetId: string;
  range: string; // A1 notation, e.g. "Sheet1!A1"
  values: SheetRow[];
}

export interface AppendSheetOptions {
  spreadsheetId: string;
  range: string; // Sheet name is sufficient, e.g. "Sheet1"
  values: SheetRow[];
}
