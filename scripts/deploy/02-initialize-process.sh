# shellcheck shell=bash

initialize_process() {
  # 1. Acquire the deployment lock and attach logging only on the first execution.
  if [ "${DEPLOY_LOCK_HELD:-false}" != true ]; then
    exec 9>"$LOCKFILE"
    if ! flock -n 9; then
      echo "ERROR: Another deploy is already running (lock: $LOCKFILE)"
      exit 1
    fi
    export DEPLOY_LOCK_HELD=true
    mkdir -p "$(dirname "$LOGFILE")"
    exec > >(tee -a "$LOGFILE") 2>&1
  fi
  # 2. Register cleanup before starting deployment work.
  trap cleanup EXIT INT TERM
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Deploy started"
}
