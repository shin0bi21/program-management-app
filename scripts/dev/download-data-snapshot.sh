#!/usr/bin/env bash
set -euo pipefail
umask 077

usage() {
  cat <<'USAGE'
Usage: bash scripts/dev/download-data-snapshot.sh --host SSH_TARGET --destination DIRECTORY [--identity KEY_PATH] [--container NAME]

Stream a PostgreSQL custom-format archive over SSH into an existing local directory.
The source database is read-only. This command does not restore data or copy uploads.
SSH_TARGET can be a configured SSH alias or user@hostname. Default container: myapp_db.
USAGE
}

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

snapshot_host=''
snapshot_destination=''
snapshot_identity=''
snapshot_container='myapp_db'
while [ "$#" -gt 0 ]; do
  case "$1" in
    --host|--destination|--identity|--container)
      [ "$#" -ge 2 ] && [ -n "$2" ] || fail "Missing value for $1"
      case "$1" in
        --host) snapshot_host="$2" ;;
        --destination) snapshot_destination="$2" ;;
        --identity) snapshot_identity="$2" ;;
        --container) snapshot_container="$2" ;;
      esac
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

[ -n "$snapshot_host" ] || fail '--host is required'
[ -n "$snapshot_destination" ] || fail '--destination is required'
[[ "$snapshot_host" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_@.:-]*$ ]] || fail 'Invalid SSH target'
[[ "$snapshot_container" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]] || fail 'Invalid container name'
[ -d "$snapshot_destination" ] || fail 'Destination must be an existing directory'
snapshot_destination="$(cd "$snapshot_destination" && pwd -P)"
snapshot_repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
case "$snapshot_destination/" in
  "$snapshot_repo/"*) fail 'Choose a destination outside this repository for live data' ;;
esac

command -v ssh >/dev/null 2>&1 || fail 'ssh is required'
if command -v shasum >/dev/null 2>&1; then
  checksum_command=(shasum -a 256)
elif command -v sha256sum >/dev/null 2>&1; then
  checksum_command=(sha256sum)
else
  fail 'shasum or sha256sum is required'
fi

ssh_options=(-T -o BatchMode=yes)
if [ -n "$snapshot_identity" ]; then
  ssh_options+=(-i "$snapshot_identity")
fi

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
cleanup() {
  rm -rf "$snapshot_work"
  if [ "$snapshot_published" != true ]; then
    if [ "$snapshot_archive_linked" = true ]; then rm -f "$snapshot_archive"; fi
    if [ "$snapshot_manifest_linked" = true ]; then rm -f "$snapshot_manifest"; fi
    if [ "$snapshot_checksums_linked" = true ]; then rm -f "$snapshot_checksums"; fi
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

printf 'Downloading database snapshot from %s...\n' "$snapshot_host" >&2
# Only the validated container identifier enters the remote command. Database credentials stay in the container.
# shellcheck disable=SC2029
if ! ssh "${ssh_options[@]}" "$snapshot_host" "sh -s -- $snapshot_container" > "$snapshot_work/archive" <<'REMOTE'
set -eu
docker exec "$1" sh -c '
  set -eu
  : "${POSTGRES_USER:?POSTGRES_USER is required}"
  : "${POSTGRES_DB:?POSTGRES_DB is required}"
  exec pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"
'
REMOTE
then
  fail 'Snapshot download failed; incomplete files were removed'
fi

[ "$(head -c 5 "$snapshot_work/archive")" = 'PGDMP' ] || fail 'Downloaded file is not a PostgreSQL custom archive'
cat > "$snapshot_work/manifest" <<MANIFEST
Captured at (UTC): $snapshot_stamp
Source SSH target: $snapshot_host
Database container: $snapshot_container
Archive: $snapshot_name
Format: PostgreSQL custom archive (pg_dump)
Contents: Database schema, records, and migration history. Uploaded files are not included.
Data handling: Raw live data; not anonymized. Do not commit or share publicly.
MANIFEST
snapshot_checksum="$("${checksum_command[@]}" "$snapshot_work/archive")"
snapshot_checksum="${snapshot_checksum%% *}"
printf '%s  %s\n' "$snapshot_checksum" "$snapshot_name" > "$snapshot_work/checksums"

# Hard links publish complete files atomically and refuse to overwrite an existing destination.
ln "$snapshot_work/archive" "$snapshot_archive"
snapshot_archive_linked=true
ln "$snapshot_work/manifest" "$snapshot_manifest"
snapshot_manifest_linked=true
ln "$snapshot_work/checksums" "$snapshot_checksums"
snapshot_checksums_linked=true
snapshot_published=true
printf 'Snapshot saved: %s\nManifest: %s\nSHA-256: %s\n' "$snapshot_archive" "$snapshot_manifest" "$snapshot_checksums"
