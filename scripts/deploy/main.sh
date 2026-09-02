#!/usr/bin/env bash
# Smart production deploy — run on the Lightsail server.
# Numbered files in this directory contain the implementation steps.

set -euo pipefail

DEPLOY_SCRIPT_SOURCE="${BASH_SOURCE[0]}"
# shellcheck disable=SC2034 # Used by the sourced repository synchronization step.
SCRIPT_PATH="$(cd "$(dirname "$DEPLOY_SCRIPT_SOURCE")" && pwd)/$(basename "$DEPLOY_SCRIPT_SOURCE")"
DEPLOY_PARTS_DIR="$(dirname "$SCRIPT_PATH")"

for deploy_part in "$DEPLOY_PARTS_DIR"/[0-9][0-9]-*.sh; do
  # shellcheck source=/dev/null
  source "$deploy_part"
done
unset deploy_part

main() {
  parse_arguments "$@"
  initialize_process
  synchronize_repository "$@"
  load_environment
  load_revision_state
  classify_changes
  print_deployment_plan

  if [ "$PLAN_ONLY" = true ]; then
    echo "Plan only; no images, containers, database state, or revision markers changed."
    return
  fi

  if [ "$INFRASTRUCTURE_CHANGED" = true ]; then
    deploy_infrastructure
    record_all_revisions
    deployment_complete
    return
  fi

  if [ "$BACKEND_CHANGED" = false ] && [ "$FRONTEND_CHANGED" = false ]; then
    echo "No production changes detected."
    record_all_revisions
    deployment_complete
    return
  fi

  # Build every required artifact before changing a running service.
  [ "$BACKEND_CHANGED" = false ] || build_backend_image
  [ "$FRONTEND_CHANGED" = false ] || build_frontend_image

  if [ "$BACKEND_CHANGED" = true ]; then
    deploy_backend
    write_revision backend "$TARGET_SHA"
  fi

  if [ "$FRONTEND_CHANGED" = true ]; then
    deploy_frontend
    write_revision frontend "$TARGET_SHA"
  fi

  # Components with no changes are also current at TARGET_SHA.
  [ "$BACKEND_CHANGED" = true ] || write_revision backend "$TARGET_SHA"
  [ "$FRONTEND_CHANGED" = true ] || write_revision frontend "$TARGET_SHA"
  write_revision infrastructure "$TARGET_SHA"
  deployment_complete
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
