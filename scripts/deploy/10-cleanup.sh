# shellcheck shell=bash

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [ "$ROLLBACK_NEEDED" = true ] && [ -n "$SNAPSHOT" ] && [ -s "$SNAPSHOT" ]; then
    echo ""
    echo "Migration failed — restoring database from pre-migration snapshot..."

    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres \
      -v dbname="$DB_NAME" \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :'dbname' AND pid <> pg_backend_pid();" \
      > /dev/null 2>&1 || true

    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
      -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" \
      > /dev/null 2>&1 || true

    if gunzip -c "$SNAPSHOT" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"; then
      echo "Database restored."
    else
      echo "ERROR: Restore failed — manual intervention required"
    fi
  fi

  rm -f "$SNAPSHOT" "$SNAPSHOT_TMP" "$LOCKFILE"
  exit "$exit_code"
}
