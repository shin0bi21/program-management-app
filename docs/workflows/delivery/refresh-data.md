# Running the Script

Run these commands from the repository root. Production data is unchanged.

## Before You Start

- Start Docker Desktop and the local database: `docker compose up -d db`.
- Have the local backend image ready; see [Local Development](../local-development/tools.md).
- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your local `.env` for signing in after import.
- Have SSH access to the production server with the key used below.
- The source backend must include `dist/db/scripts/snapshot-data.js`. Downloads
  use `myapp_backend` by default; pass `--container` to select another backend.
  Allow temporary archive space there. The shared snapshot helper removes the
  server archive after transfer or failure; failed exports retain private
  diagnostics and print their container path.

Both commands use `scripts/dev/helpers/snapshot-data.sh` to export, transfer, and
clean up the server snapshot. Import applies the copy locally and deletes its
temporary local files on exit. Download keeps the local archive, manifest, and
checksum in your chosen directory.

## Refresh Local Data

Replace your local development data with a fresh production copy:

```bash
bash scripts/dev/import-data.sh \
  --host ubuntu@18.216.104.46 \
  --identity "$HOME/.ssh/be-original-key.pem" \
  --apply
```

When finished, reload <http://localhost:5173> and sign in with your local
`ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Validate Without Replacing Local Data

```bash
bash scripts/dev/import-data.sh \
  --host ubuntu@18.216.104.46 \
  --identity "$HOME/.ssh/be-original-key.pem" \
  --validate-only
```

## Download Only

Save an archive without importing it. Keep downloaded production data outside Git
and shared folders.

```bash
mkdir -p -m 700 "$HOME/Desktop/my-webapp-snapshots"
bash scripts/dev/download-data.sh \
  --host ubuntu@18.216.104.46 \
  --identity "$HOME/.ssh/be-original-key.pem" \
  --destination "$HOME/Desktop/my-webapp-snapshots"
```
