# shellcheck shell=bash disable=SC2034
# Load environment and component revision markers; publish revisions after successful work.

# Load repository environment values and create the configured revision-marker directory.
# Example: load_environment # prepares STATE_DIR
load_environment() {
  # shellcheck source=/dev/null
  [ ! -f .env ] || { set -a; source .env; set +a; }
  mkdir -p "$STATE_DIR"
}

# Print a component marker only when it still resolves to a commit; missing history prints nothing.
# Example: read_revision frontend
read_revision() {
  # 1. Read the selected component marker without requiring one to exist.
  local component="$1"
  local marker="$STATE_DIR/${component}-revision"
  local revision=""

  if [ -s "$marker" ]; then
    revision="$(tr -d '[:space:]' < "$marker")"
  fi

  # 2. Accept only revisions that still resolve to a commit.
  if [ -n "$revision" ] && git cat-file -e "${revision}^{commit}" 2>/dev/null; then
    printf '%s' "$revision"
  fi
}

# Atomically publish a successfully deployed component revision under STATE_DIR.
# Example: write_revision frontend "$TARGET_SHA"
write_revision() {
  local component="$1"
  local revision="$2"
  local temp_marker

  # 1. Write a complete revision marker to a same-directory temporary file.
  temp_marker="$(mktemp "$STATE_DIR/.${component}-revision.XXXXXX")"
  printf '%s\n' "$revision" > "$temp_marker"
  # 2. Publish the marker atomically after the component succeeds.
  mv "$temp_marker" "$STATE_DIR/${component}-revision"
}

# Read each component revision, retaining empty values for unavailable deployment history.
# Example: load_revision_state # populates the three revision globals
load_revision_state() {
  FRONTEND_REVISION="$(read_revision frontend)"
  BACKEND_REVISION="$(read_revision backend)"
  INFRASTRUCTURE_REVISION="$(read_revision infrastructure)"
}

# Succeed when history is missing or the supplied paths differ from TARGET_SHA.
# Example: revision_changed "$BACKEND_REVISION" backend/src
revision_changed() {
  local revision="$1"
  shift

  [ -z "$revision" ] || ! git diff --quiet "$revision" "$TARGET_SHA" -- "$@"
}
