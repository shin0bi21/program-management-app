# shellcheck shell=bash disable=SC2034
# Deployment database phase: snapshot → status → apply → status.
# Sourced by main.sh; configuration and the EXIT rollback trap belong to the
# deployment lifecycle. ROLLBACK_NEEDED covers migration apply and post-status.

require_database() {
  : "${DB_USER:?DB_USER not set — check .env}"
  : "${DB_NAME:?DB_NAME not set — check .env}"

  if [ "$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null || true)" != true ]; then
    echo "ERROR: DB container '$DB_CONTAINER' is not running"
    exit 1
  fi
}

take_database_snapshot() {
  require_database
  echo ""
  echo "Taking pre-migration snapshot..."
  SNAPSHOT="$(mktemp /tmp/migration-snapshot.XXXXXX.sql.gz)"
  SNAPSHOT_TMP="${SNAPSHOT}.tmp"
  docker exec "$DB_CONTAINER" pg_dump --clean --if-exists -U "$DB_USER" "$DB_NAME" | gzip > "$SNAPSHOT_TMP"

  if ! gzip -t "$SNAPSHOT_TMP" 2>/dev/null || [ ! -s "$SNAPSHOT_TMP" ]; then
    echo "ERROR: Snapshot is empty or corrupt — aborting"
    exit 1
  fi

  mv "$SNAPSHOT_TMP" "$SNAPSHOT"
  echo "Snapshot saved and verified."
}

run_migration_status() {
  docker compose run --rm --no-deps -e NODE_ENV=production backend node dist/db/scripts/update_schemas.js --dry-run
}

run_migration_flow() {
  take_database_snapshot

  echo ""
  echo "Checking migration status before apply..."
  run_migration_status

  echo ""
  echo "Applying pending migrations..."
  ROLLBACK_NEEDED=true
  docker compose run --rm --no-deps -e NODE_ENV=production backend node dist/db/scripts/update_schemas.js

  echo ""
  echo "Checking migration status after apply..."
  run_migration_status
  ROLLBACK_NEEDED=false
}
