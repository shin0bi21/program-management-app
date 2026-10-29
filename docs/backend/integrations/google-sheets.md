# Google Sheets scripts

Use the helpers in [backend/scripts/googleSheets](../../../backend/scripts/googleSheets/)
for one-off spreadsheet imports and exports. They are script-only utilities, outside the
Express request path.

## Set up access

1. In [Google Cloud Console](https://console.cloud.google.com/), create a service account
   under **IAM & Admin → Service Accounts** and download its JSON key.
2. Enable the **Google Sheets API** for the project.
3. Encode the key and set `GOOGLE_SERVICE_ACCOUNT_JSON` in the root `.env`:

   ```bash
   base64 -i your-service-account-key.json | tr -d '\n'
   ```

4. Share the spreadsheet with the service account email. Grant Viewer for reads or Editor
   for writes. Keep the key and `.env` out of Git.
5. Recreate the local backend container after changing `.env`, following
   [Local development](../../workflows/local-development.md#which-command-to-use).

`GOOGLE_SERVICE_ACCOUNT_JSON` is required only when running Sheets scripts. Normal server
operation does not need it.

## Check the connection

Run from the repository root with the local backend container running:

```bash
docker compose exec backend npx tsx scripts/googleSheets/test-connection.ts <spreadsheet-id>
```

The spreadsheet ID is the value between `/d/` and `/edit` in its URL. The smoke test reads
metadata and prints the spreadsheet title and tab names.

| Failure | Check |
|---|---|
| Environment variable missing | Set `GOOGLE_SERVICE_ACCOUNT_JSON` and recreate the backend container |
| Credentials cannot be decoded | Re-encode the complete service account JSON key |
| Permission denied | Share the spreadsheet with the service account email |
| Spreadsheet not found | Check the spreadsheet ID and account access |

## Read or change cells

| Helper | Behavior |
|---|---|
| `readSheet({ spreadsheetId, range })` | Return rows of cell values; trailing empty cells may be omitted |
| `writeSheet({ spreadsheetId, range, values })` | Overwrite the cells covered by `values`, leaving other cells untouched |
| `appendToSheet({ spreadsheetId, range, values })` | Insert rows after the table's existing data |

Ranges use A1 notation, such as `Sheet1!A2:F`. Writes use raw values without formula parsing.
See the [helper implementation](../../../backend/scripts/googleSheets/index.ts) and
[option types](../../../backend/scripts/googleSheets/types.ts) for the complete API.
Use `getSheetsClient()` from the same module for operations outside these helpers.

## Add a script

Place scripts under `backend/scripts/`. For example, `backend/scripts/read-roster.ts`:

```ts
import 'dotenv/config';
import { readSheet } from './googleSheets';

async function main() {
  const spreadsheetId = process.argv[2];
  if (!spreadsheetId) throw new Error('Provide a spreadsheet ID');

  const rows = await readSheet({ spreadsheetId, range: 'Sheet1!A2:F' });
  console.log(`Read ${rows.length} rows`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
```

Run it with `docker compose exec backend npx tsx scripts/read-roster.ts <spreadsheet-id>`.
Validate spreadsheet values before importing them. If a script opens the database client,
close it with `await sql.end()` in `finally` so failures also release the connection pool.
