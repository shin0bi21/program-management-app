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
  # 1. Validate arguments and handle preview before acquiring deployment resources.
  parse_arguments "$@"
  if [ "$PREVIEW_ONLY" = true ]; then
    preview_deployment
    return
  fi

  # 2. Lock deployment, synchronize the target, and classify changes from recorded revisions.
  initialize_process
  synchronize_repository "$@"
  load_environment
  load_revision_state
  classify_changes
  print_deployment_summary

  # 3. Use the complete flow for infrastructure changes and record only successful revisions.
  if [ "$INFRASTRUCTURE_CHANGED" = true ]; then
    deploy_infrastructure
    record_all_revisions
    deployment_complete
    return
  fi

  # 4. Record an already-current target without replacing services.
  if [ "$BACKEND_CHANGED" = false ] && [ "$FRONTEND_CHANGED" = false ]; then
    echo "No production changes detected."
    record_all_revisions
    deployment_complete
    return
  fi

  # 5. Build required artifacts before replacing either running service.
  # Build every required artifact before changing a running service.
  [ "$BACKEND_CHANGED" = false ] || build_backend_image
  [ "$FRONTEND_CHANGED" = false ] || build_frontend_image

  # 6. Deploy selected components and record each revision after its health gate.
  if [ "$BACKEND_CHANGED" = true ]; then
    deploy_backend
    write_revision backend "$TARGET_SHA"
  fi

  if [ "$FRONTEND_CHANGED" = true ]; then
    deploy_frontend
    write_revision frontend "$TARGET_SHA"
  fi

  # 7. Advance unchanged component markers and report completion.
  # Components with no changes are also current at TARGET_SHA.
  [ "$BACKEND_CHANGED" = true ] || write_revision backend "$TARGET_SHA"
  [ "$FRONTEND_CHANGED" = true ] || write_revision frontend "$TARGET_SHA"
  write_revision infrastructure "$TARGET_SHA"
  deployment_complete
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
