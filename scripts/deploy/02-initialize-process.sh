# shellcheck shell=bash

# Acquire the configured lock and logging once; register cleanup before deployment work.
# Example: initialize_process # uses LOCKFILE, LOGFILE, and DEPLOY_LOCK_HELD
initialize_process() {
  # 1. Acquire the deployment lock only on the first execution.
  local initialize_logging=false
  if [ "${DEPLOY_LOCK_HELD:-false}" != true ]; then
    exec 9>"$LOCKFILE"
    if ! flock -n 9; then
      echo "ERROR: Another deploy is already running (lock: $LOCKFILE)" >&2
      exit 1
    fi
    export DEPLOY_LOCK_HELD=true
    initialize_logging=true
  fi
  # 2. Register cleanup before starting deployment work.
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  # 3. Attach logging only after the lock's failure cleanup is ready.
  if [ "$initialize_logging" = true ]; then
    mkdir -p "$(dirname "$LOGFILE")"
    exec > >(tee -a "$LOGFILE") 2>&1
  fi

  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Deploy started"
}
