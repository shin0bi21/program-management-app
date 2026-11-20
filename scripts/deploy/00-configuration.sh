# shellcheck shell=bash disable=SC2034
# Initialize repository paths, revision state, and deployment flags; sourced by main.sh.

# Repository and production runtime configuration.
REPO_ROOT="${DEPLOY_REPO_ROOT:-$(cd "$(dirname "$DEPLOY_SCRIPT_SOURCE")/../.." && pwd)}"
cd "$REPO_ROOT" || exit

export COMPOSE_FILE="docker-compose.prod.yml"

LOCKFILE="${DEPLOY_LOCKFILE:-/tmp/myapp-deploy.lock}"
LOGFILE="${DEPLOY_LOG:-./logs/deploy.log}"
STATE_DIR="${DEPLOY_STATE_DIR:-./.deploy-state}"
DB_CONTAINER="myapp_db"

# Target and last successfully deployed component revisions.
TARGET_SHA=""
FRONTEND_REVISION=""
BACKEND_REVISION=""
INFRASTRUCTURE_REVISION=""

# Change classification used to select the deployment flow.
FRONTEND_CHANGED=false
BACKEND_CHANGED=false
MIGRATIONS_CHANGED=false
INFRASTRUCTURE_CHANGED=false

# Temporary migration and service-replacement state.
SNAPSHOT=""
SNAPSHOT_TMP=""
ROLLBACK_NEEDED=false
REPLACED_CONTAINER_ID=""

# Command-line mode.
PREVIEW_ONLY=false
