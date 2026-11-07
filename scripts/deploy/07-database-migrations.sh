# shellcheck shell=bash disable=SC2034
# Deployment database phase: snapshot → status → apply → status.
# Sourced by main.sh; configuration and the EXIT rollback trap belong to the
# deployment lifecycle. ROLLBACK_NEEDED covers migration apply and post-status.

require_database() {
  # 1. Require configured database identifiers before inspecting the container.
  : "${DB_USER:?DB_USER not set — check .env}"
  : "${DB_NAME:?DB_NAME not set — check .env}"

  # 2. Abort before exporting if the database container is unavailable.
  if [ "$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null || true)" != true ]; then
    echo "ERROR: DB container '$DB_CONTAINER' is not running"
    exit 1
  fi
}

take_database_snapshot() {
  # 1. Verify the database and export to a temporary compressed snapshot.
  require_database
  echo ""
  echo "Taking pre-migration snapshot..."
  SNAPSHOT="$(mktemp /tmp/migration-snapshot.XXXXXX.sql.gz)"
  SNAPSHOT_TMP="${SNAPSHOT}.tmp"
  docker exec "$DB_CONTAINER" pg_dump --clean --if-exists -U "$DB_USER" "$DB_NAME" | gzip > "$SNAPSHOT_TMP"

  # 2. Reject empty or corrupt output before publishing the snapshot path.
  if ! gzip -t "$SNAPSHOT_TMP" 2>/dev/null || [ ! -s "$SNAPSHOT_TMP" ]; then
    echo "ERROR: Snapshot is empty or corrupt — aborting"
    exit 1
  fi

  # 3. Publish the verified snapshot for the rollback guard.
  mv "$SNAPSHOT_TMP" "$SNAPSHOT"
  echo "Snapshot saved and verified."
}

run_migration_status() {
  docker compose run --rm --no-deps -e NODE_ENV=production backend node dist/db/scripts/update_schemas.js --dry-run
}

run_migration_flow() {
  # 1. Capture recovery data and validate existing migration history before applying files.
  take_database_snapshot

  echo ""
  echo "Checking migration status before apply..."
  run_migration_status

  echo ""
  echo "Applying pending migrations..."
  # 2. Arm rollback only around migration apply and its post-apply status check.
  ROLLBACK_NEEDED=true
  docker compose run --rm --no-deps -e NODE_ENV=production backend node dist/db/scripts/update_schemas.js

  echo ""
  echo "Checking migration status after apply..."
  run_migration_status
  # 3. End automatic database rollback after successful migration validation.
  ROLLBACK_NEEDED=false
}
