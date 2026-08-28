# shellcheck shell=bash

reexecute_deploy() {
  exec "$SCRIPT_PATH" "$@"
}

synchronize_repository() {
  if [ "${DEPLOY_BOOTSTRAPPED:-false}" = true ]; then
    TARGET_SHA="${DEPLOY_TARGET_SHA:?Missing bootstrapped target revision}"
    return
  fi
  echo ""
  echo "Pulling latest code..."
  if [ -n "$(git status --porcelain)" ]; then
    echo "ERROR: Working tree has uncommitted changes. Resolve before deploying:"
    git status --short
    exit 1
  fi
  local previous_sha
  previous_sha="$(git rev-parse HEAD)"
  git fetch origin main
  TARGET_SHA="$(git rev-parse origin/main)"
  if [ "$previous_sha" != "$TARGET_SHA" ]; then
    git reset --hard "$TARGET_SHA"
    export DEPLOY_BOOTSTRAPPED=true DEPLOY_TARGET_SHA="$TARGET_SHA"
    # Re-execute fresh code so a script update cannot mix old and new functions.
    reexecute_deploy "$@"
  fi
  echo "Deploying commit: $(git log -1 --oneline "$TARGET_SHA")"
}
