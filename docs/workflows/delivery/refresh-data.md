# Running the Script

Run these commands from the repository root. Production data is unchanged.
Use your server address and SSH key path in `--host` and `--identity`.

## Refresh Local Data

Replace your local development data with a fresh production copy:

```bash
docker compose up -d db
bash scripts/dev/import-data.sh \
  --host ubuntu@18.216.104.46 \
  --identity "$HOME/.ssh/be-original-key.pem" \
  --apply
```

When finished, reload <http://localhost:5173> and sign in with your local
`ADMIN_EMAIL` and `ADMIN_PASSWORD`. Check a few known records before removing
the printed `local_snapshot_backup_*` backup. If the command fails, use
[Recover a Data Refresh](refresh-data/recovery.md).

## Validate Without Replacing Local Data

```bash
docker compose up -d db
bash scripts/dev/import-data.sh \
  --host ubuntu@18.216.104.46 \
  --identity "$HOME/.ssh/be-original-key.pem" \
  --validate-only
```

Validation should finish without replacing the current local database or backend.

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

## Verify a Downloaded Archive

Replace the filename below with the `.sha256` file printed by the download:

```bash
cd "$HOME/Desktop/my-webapp-snapshots"
shasum -a 256 -c production-YYYYMMDDTHHMMSSZ-SUFFIX.dump.sha256
```

The archive should report `OK`. Return to the project root before running
another project command.

## Export a Local Snapshot

From the project root, with the local database running, mount a private host directory into a
one-off container so the archive survives its removal:

```bash
snapshot_directory="$(mktemp -d /tmp/my-webapp-snapshots.XXXXXX)"
docker compose run -T --rm --no-deps --user "$(id -u):$(id -g)" \
  -v "$snapshot_directory:/snapshots" backend \
  npm exec -- tsx db/scripts/snapshot-data.ts --output /snapshots/current.dump
```
