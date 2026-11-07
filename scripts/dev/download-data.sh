#!/usr/bin/env bash
# DOWNLOAD DATA — keep a local archive using the shared snapshot lifecycle.
# Flow: parse options → acquire snapshot → report retained files.

set -euo pipefail
umask 077

usage() {
  cat <<'USAGE'
Usage: bash scripts/dev/download-data.sh --host SSH_TARGET --destination DIRECTORY [--identity KEY_PATH] [--container NAME]

Stream a PostgreSQL custom-format archive over SSH into an existing local directory.
The source database is read-only. This command does not restore data or copy uploads.
SSH_TARGET can be a configured SSH alias or user@hostname. Default backend container: myapp_backend.
The deployed backend must include the snapshot-data exporter.
USAGE
}

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# 1. Parse snapshot source, destination, and optional SSH settings.
download_host=''
download_destination=''
download_identity=''
download_container='myapp_backend'
while [ "$#" -gt 0 ]; do
  case "$1" in
    --host|--destination|--identity|--container)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        fail "Missing value for $1"
      fi
      case "$1" in
        --host) download_host="$2" ;;
        --destination) download_destination="$2" ;;
        --identity) download_identity="$2" ;;
        --container) download_container="$2" ;;
      esac
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done

# 2. Load the shared snapshot lifecycle from this checkout.
script_directory="$(cd "$(dirname "$0")" && pwd -P)"
# shellcheck source=scripts/dev/helpers/snapshot-data.sh
source "$script_directory/helpers/snapshot-data.sh"

# 3. Acquire the snapshot and report all retained artifact paths.
snapshot_archive="$(snapshot_data "$download_host" "$download_destination" "$download_identity" "$download_container")"
printf 'Snapshot saved: %s\nManifest: %s\nSHA-256: %s\n' "$snapshot_archive" "$snapshot_archive.txt" "$snapshot_archive.sha256"
