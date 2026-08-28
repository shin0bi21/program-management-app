# shellcheck shell=bash disable=SC2034

load_environment() {
  # shellcheck source=/dev/null
  [ ! -f .env ] || { set -a; source .env; set +a; }
  mkdir -p "$STATE_DIR"
}

read_revision() {
  local component="$1"
  local marker="$STATE_DIR/${component}-revision"
  local revision=""

  if [ -s "$marker" ]; then
    revision="$(tr -d '[:space:]' < "$marker")"
  fi

  if [ -n "$revision" ] && git cat-file -e "${revision}^{commit}" 2>/dev/null; then
    printf '%s' "$revision"
  fi
}

write_revision() {
  local component="$1"
  local revision="$2"
  local temp_marker

  temp_marker="$(mktemp "$STATE_DIR/.${component}-revision.XXXXXX")"
  printf '%s\n' "$revision" > "$temp_marker"
  mv "$temp_marker" "$STATE_DIR/${component}-revision"
}

load_revision_state() {
  FRONTEND_REVISION="$(read_revision frontend)"
  BACKEND_REVISION="$(read_revision backend)"
  INFRASTRUCTURE_REVISION="$(read_revision infrastructure)"
}

revision_changed() {
  local revision="$1"
  shift

  [ -z "$revision" ] || ! git diff --quiet "$revision" "$TARGET_SHA" -- "$@"
}
