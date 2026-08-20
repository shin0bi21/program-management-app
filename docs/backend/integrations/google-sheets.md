# Google Sheets Integration

Service-account setup and the script-only environment variable are documented below.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication — Service Account Setup](#2-authentication--service-account-setup)
3. [API Reference](#3-api-reference)
4. [Running the Smoke Test](#4-running-the-smoke-test)
5. [Usage Pattern for New Scripts](#5-usage-pattern-for-new-scripts)

---

## 1. Overview

The Google Sheets integration is a **script-only utility** — it is never called from the Express HTTP server or any route handler. It exists to support one-off data import/export scripts (e.g. bulk-importing youth profiles from a spreadsheet maintained by program staff).

```
backend/
  src/
    integrations/
      googleSheets/
        client.ts    ← authenticated Sheets client (lazy-init singleton)
        index.ts     ← readSheet(), writeSheet(), appendToSheet()
        types.ts     ← SheetRow, ReadSheetOptions, WriteSheetOptions, AppendSheetOptions
  db/
    scripts/
      test-sheets-connection.ts  ← smoke test — verify credentials + spreadsheet access
```

The client is authenticated via a **Google service account** — no OAuth browser flow, no user credentials. The service account must be granted Viewer (read) or Editor (read + write) access on each spreadsheet it needs to access.

---

## 2. Authentication — Service Account Setup

### Creating the service account

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **IAM & Admin → Service Accounts**.
2. Create a new service account (e.g. `sheets-importer@your-project.iam.gserviceaccount.com`).
3. Under **Keys**, add a JSON key — download the `.json` file.
4. Enable the **Google Sheets API** for your project under **APIs & Services → Enabled APIs**.

### Encoding the credentials

The key file must be base64-encoded before being stored in the environment:

```bash
base64 -i your-service-account-key.json | tr -d '\n'
```

Copy the output and set it as `GOOGLE_SERVICE_ACCOUNT_JSON` in your `.env`.

### Granting spreadsheet access

Open the target spreadsheet in Google Sheets → **Share** → paste the service account email → set role to **Viewer** (read-only) or **Editor** (read + write).

### Environment variable

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Yes (scripts only) | Base64-encoded service account JSON key |

This variable is **not** needed for normal server operation — only set it in environments where Sheets scripts will run.

---

## 3. API Reference

All functions are exported from `src/integrations/googleSheets/index.ts`.

### Types

```ts
// A single spreadsheet row — an array of primitive cell values
type SheetRow = (string | number | boolean | null)[];

interface ReadSheetOptions {
  spreadsheetId: string;
  range: string;          // A1 notation, e.g. "Sheet1!A1:Z" or "Sheet1!A2:F100"
}

interface WriteSheetOptions {
  spreadsheetId: string;
  range: string;          // Top-left cell of the write target, e.g. "Sheet1!A1"
  values: SheetRow[];
}

interface AppendSheetOptions {
  spreadsheetId: string;
  range: string;          // Sheet name is sufficient, e.g. "Sheet1"
  values: SheetRow[];
}
```

The `spreadsheetId` is the long alphanumeric string in the Google Sheets URL:
```
https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
```

---

### `readSheet(options)`

Read a range from a spreadsheet. Returns rows as arrays of cell values. Trailing empty cells in a row are omitted by the Sheets API.

```ts
import { readSheet } from '../integrations/googleSheets';

const rows = await readSheet({
  spreadsheetId: 'your-spreadsheet-id',
  range: 'Sheet1!A1:F',   // all rows, columns A–F
});
// rows[0] = header row, rows[1..] = data rows
```

---

### `writeSheet(options)`

Overwrite a range with new values. Uses `RAW` input — values are written exactly as provided, no formula parsing. Overwrites only the cells covered by `values`; cells outside the range are untouched.

```ts
import { writeSheet } from '../integrations/googleSheets';

await writeSheet({
  spreadsheetId: 'your-spreadsheet-id',
  range: 'Sheet1!A1',
  values: [
    ['Name', 'DOB', 'School'],
    ['Alice', '2010-05-01', 'Westview'],
  ],
});
```

---

### `appendToSheet(options)`

Append rows after the last row that contains data. Does not overwrite existing content. Uses `INSERT_ROWS` mode — inserts new rows rather than overwriting blank trailing rows.

```ts
import { appendToSheet } from '../integrations/googleSheets';

await appendToSheet({
  spreadsheetId: 'your-spreadsheet-id',
  range: 'Sheet1',        // sheet name only — API finds the last row automatically
  values: [
    ['Bob', '2011-03-12', 'Eastfield'],
  ],
});
```

---

### `getSheetsClient()` / `resetSheetsClient()`

The raw authenticated `sheets_v4.Sheets` client is available for operations not covered by the helpers above (e.g. reading spreadsheet metadata, working with multiple sheets).

```ts
import { getSheetsClient } from '../integrations/googleSheets';

const sheets = getSheetsClient();
const meta = await sheets.spreadsheets.get({ spreadsheetId: 'your-id' });
```

`resetSheetsClient()` clears the cached singleton — useful in tests or when credentials change mid-process.

---

## 4. Running the Smoke Test

Before using the integration in a new environment, verify that credentials are valid and the target spreadsheet is accessible:

```bash
# From inside the backend container or with ts-node available locally
SPREADSHEET_ID=<your-sheet-id> npx tsx db/scripts/test-sheets-connection.ts

# Or pass the ID as a positional argument
npx tsx db/scripts/test-sheets-connection.ts <your-sheet-id>
```

A successful run prints:

```
Connecting to Google Sheets...

✓ Connected successfully

  Spreadsheet ID : 1BxiMV...
  Title          : Youth Program Roster 2026
  Tabs           : Sheet1, Archive
```

**Required env var:** `GOOGLE_SERVICE_ACCOUNT_JSON` must be set in the environment before running.

**Common failures:**

| Error | Cause | Fix |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON is not set` | Env var missing | Set the var (see §2) |
| `GOOGLE_SERVICE_ACCOUNT_JSON could not be decoded` | Bad base64 | Re-encode the JSON key file |
| `The caller does not have permission` | Service account not shared on the sheet | Share the sheet with the service account email (see §2) |
| `Requested entity was not found` | Wrong spreadsheet ID | Double-check the ID in the sheet URL |

---

## 5. Usage Pattern for New Scripts

```ts
// db/scripts/my-import-script.ts
import 'dotenv/config';
import { readSheet } from '../../src/integrations/googleSheets';
import { sql } from '../../src/db/client';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID ?? process.argv[2];
if (!SPREADSHEET_ID) {
  console.error('SPREADSHEET_ID is required');
  process.exit(1);
}

async function main() {
  const rows = await readSheet({ spreadsheetId: SPREADSHEET_ID!, range: 'Sheet1!A2:F' });

  for (const [name, dob, school] of rows) {
    // validate, transform, insert...
    await sql`INSERT INTO ... VALUES (${name}, ${dob}, ${school})`;
  }

  console.log(`Imported ${rows.length} rows`);
  await sql.end();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

**Pattern rules:**
- Always call `await sql.end()` at the end of a script to release the connection pool.
- Always call `dotenv/config` at the top so `.env` is loaded.
- Guard `SPREADSHEET_ID` (and any other required inputs) at the top — fail fast with a clear message rather than a cryptic runtime error mid-import.
- Scripts live in `db/scripts/` and are run with `npx tsx db/scripts/<script>.ts`.
