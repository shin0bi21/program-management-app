#!/usr/bin/env bash
# Shared snapshot lifecycle for import-data.sh and download-data.sh.
# snapshot_data HOST DESTINATION [IDENTITY] [CONTAINER] prints the archive path.
# Owns export, transfer, manifest/checksum publication, and temporary cleanup.
# The caller owns retention of the published local files. Runs in a subshell so
# its traps and private settings cannot replace the caller's rollback handlers.

snapshot_data() (
  # 1. Confine settings, traps, and private temporary files to this snapshot subshell.
  set -euo pipefail
  umask 077

  snapshot_fail() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
  }

  # 2. Validate the source and destination before connecting to the remote host.
  snapshot_host="${1:-}"
  snapshot_destination="${2:-}"
  snapshot_identity="${3:-}"
  snapshot_container="${4:-myapp_backend}"

  [ -n "$snapshot_host" ] || snapshot_fail '--host is required'
  [ -n "$snapshot_destination" ] || snapshot_fail '--destination is required'
  [[ "$snapshot_host" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_@.:-]*$ ]] || snapshot_fail 'Invalid SSH target'
  [[ "$snapshot_container" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || snapshot_fail 'Invalid container name'
  [ -d "$snapshot_destination" ] || snapshot_fail 'Destination must be an existing directory'
  snapshot_destination="$(cd "$snapshot_destination" && pwd -P)"
  snapshot_repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P)"
  case "$snapshot_destination/" in
    "$snapshot_repo/"*) snapshot_fail 'Choose a destination outside this repository for live data' ;;
  esac

  # 3. Select available SSH and checksum tools without exposing remote credentials.
  command -v ssh >/dev/null 2>&1 || snapshot_fail 'ssh is required'
  if command -v shasum >/dev/null 2>&1; then
    checksum_command=(shasum -a 256)
  elif command -v sha256sum >/dev/null 2>&1; then
    checksum_command=(sha256sum)
  else
    snapshot_fail 'shasum or sha256sum is required'
  fi

  ssh_options=(-T -o BatchMode=yes)
  if [ -n "$snapshot_identity" ]; then
    ssh_options+=(-i "$snapshot_identity")
  fi

  # 4. Allocate unique temporary files and register cleanup before transfer.
  snapshot_stamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  snapshot_work="$(mktemp -d "$snapshot_destination/.snapshot-$snapshot_stamp.XXXXXX")"
  snapshot_suffix="${snapshot_work##*.}"
  snapshot_name="production-$snapshot_stamp-$snapshot_suffix.dump"
  snapshot_archive="$snapshot_destination/$snapshot_name"
  snapshot_manifest="$snapshot_archive.txt"
  snapshot_checksums="$snapshot_archive.sha256"
  snapshot_published=false
  snapshot_archive_linked=false
  snapshot_manifest_linked=false
  snapshot_checksums_linked=false
  # Invoked by the EXIT trap in this subshell.
  # shellcheck disable=SC2317,SC2329
  cleanup() {
    # Remove temporary and partially published files, preserving completed snapshots.
    rm -rf "$snapshot_work"

    if [ "$snapshot_published" != true ]; then
      if [ "$snapshot_archive_linked" = true ]; then
        rm -f "$snapshot_archive"
      fi
      if [ "$snapshot_manifest_linked" = true ]; then
        rm -f "$snapshot_manifest"
      fi
      if [ "$snapshot_checksums_linked" = true ]; then
        rm -f "$snapshot_checksums"
      fi
    fi
  }
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  # 5. Stream a verified remote archive while keeping binary stdout separate from progress.
  printf 'Downloading database snapshot from %s...\n' "$snapshot_host" >&2
  # Only the validated container identifier enters the remote command. Database credentials stay in the container.
  # shellcheck disable=SC2029
  if ! ssh "${ssh_options[@]}" "$snapshot_host" "sh -s -- $snapshot_container" > "$snapshot_work/archive" <<'REMOTE'
set -eu
docker exec -i "$1" sh -s <<'CONTAINER'
set -eu
umask 077
if [ ! -f dist/db/scripts/snapshot-data.js ]; then
  printf 'ERROR: The deployed backend lacks dist/db/scripts/snapshot-data.js; update the backend before exporting.\n' >&2
  exit 1
fi
work="$(mktemp -d /tmp/database-snapshot.XXXXXX)"
finish_snapshot() {
  # 1. Preserve the export status and remove the transient binary archive.
  status=$?
  trap - EXIT
  rm -f "$work/archive.dump"

  # 2. Retain private diagnostics only for a failed remote export.
  if [ "$status" -eq 0 ]; then
    rm -rf "$work"
  else
    printf 'Snapshot export failed; private diagnostics retained in backend container at %s\n' "$work" >&2
  fi
  exit "$status"
}
trap finish_snapshot EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# CLI progress belongs on stderr; stdout carries only the verified binary archive.
node dist/db/scripts/snapshot-data.js --output "$work/archive.dump" >&2
[ "$(head -c 5 "$work/archive.dump")" = PGDMP ] || {
  printf 'ERROR: Backend exporter did not produce a PostgreSQL custom archive.\n' >&2
  exit 1
}
cat "$work/archive.dump"
CONTAINER
REMOTE
  then
    snapshot_fail 'Snapshot download failed; incomplete files were removed'
  fi

  # 6. Validate the downloaded format and prepare its manifest and checksum.
  [ "$(head -c 5 "$snapshot_work/archive")" = 'PGDMP' ] || snapshot_fail 'Downloaded file is not a PostgreSQL custom archive'
  cat > "$snapshot_work/manifest" <<MANIFEST
Captured at (UTC): $snapshot_stamp
Source SSH target: $snapshot_host
Backend exporter container: $snapshot_container
Archive: $snapshot_name
Format: PostgreSQL custom archive (pg_dump)
Contents: Database schema, records, and migration history. Uploaded files are not included.
Data handling: Raw live data; not anonymized. Do not commit or share publicly.
MANIFEST
  snapshot_checksum="$("${checksum_command[@]}" "$snapshot_work/archive")"
  snapshot_checksum="${snapshot_checksum%% *}"
  printf '%s  %s\n' "$snapshot_checksum" "$snapshot_name" > "$snapshot_work/checksums"

  # 7. Publish complete files without overwriting existing destinations.
  # Hard links publish complete files atomically and refuse to overwrite an existing destination.
  ln "$snapshot_work/archive" "$snapshot_archive"
  snapshot_archive_linked=true
  ln "$snapshot_work/manifest" "$snapshot_manifest"
  snapshot_manifest_linked=true
  ln "$snapshot_work/checksums" "$snapshot_checksums"
  snapshot_checksums_linked=true
  snapshot_published=true
  printf '%s\n' "$snapshot_archive"
)
