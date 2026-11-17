# shellcheck shell=bash

# Selects infrastructure work from changed paths between recorded and target revisions.
# Reads INFRASTRUCTURE_REVISION and TARGET_SHA; sets INFRASTRUCTURE_CHANGED.
# Example: a backend/Dockerfile change selects the full deployment flow.
classify_infrastructure_changes() {
  # 1. Missing infrastructure history requires the full deployment flow.
  if [ -z "$INFRASTRUCTURE_REVISION" ]; then
    INFRASTRUCTURE_CHANGED=true
    return
  fi

  # 2. Classify changed paths conservatively; unknown owners select infrastructure.
  local path
  while IFS= read -r path; do
    case "$path" in
      frontend/Dockerfile|frontend/.dockerignore|backend/Dockerfile|backend/.dockerignore|docker-compose.prod.yml|nginx.conf|scripts/deploy/*)
        INFRASTRUCTURE_CHANGED=true
        ;;
      frontend/*|backend/*|.agents/*|.github/*|docs/*|AGENTS.md|README.md|.gitignore|.codexignore|.openaiignore)
        ;;
      docker-compose.yml|eslint.config.js|package.json|package-lock.json|tsconfig.json)
        ;;
      scripts/tests/*|scripts/dev/*|scripts/reports/*|"")
        ;;
      *)
        echo "Conservative full deploy: unclassified production path '$path'."
        INFRASTRUCTURE_CHANGED=true
        ;;
    esac
  done < <(git diff --name-only "$INFRASTRUCTURE_REVISION" "$TARGET_SHA")
}

# Selects application and migration work using each component's recorded revision.
# Reads revision globals and TARGET_SHA; updates the four component change flags.
# Example: a backend/src change selects backend work without migrations.
classify_changes() {
  # 1. Compare each component with its own last successful revision.
  if revision_changed "$FRONTEND_REVISION" \
    frontend/src frontend/public frontend/index.html frontend/package.json \
    frontend/package-lock.json frontend/vite.config.ts frontend/tsconfig.json \
    frontend/tsconfig.node.json; then
    FRONTEND_CHANGED=true
  fi

  if revision_changed "$BACKEND_REVISION" \
    backend/src backend/db backend/package.json backend/package-lock.json \
    backend/tsconfig.json backend/tsconfig.build.json; then
    BACKEND_CHANGED=true
  fi

  # 2. Select migration work independently from other backend changes.
  if revision_changed "$BACKEND_REVISION" backend/db; then
    MIGRATIONS_CHANGED=true
  fi

  # 3. Infrastructure changes require both components and migration validation.
  classify_infrastructure_changes
  if [ "$INFRASTRUCTURE_CHANGED" = true ]; then
    FRONTEND_CHANGED=true
    BACKEND_CHANGED=true
    MIGRATIONS_CHANGED=true
  fi
}

# Prints the selected target and component flags without changing deployment state.
# Reads TARGET_SHA and the component change flags.
# Example: preview prints Frontend: true when frontend work is selected.
print_deployment_summary() {
  echo ""
  echo "=========================================="
  echo "SMART DEPLOY"
  echo "=========================================="
  echo "Target:         $TARGET_SHA"
  echo "Frontend:       $FRONTEND_CHANGED"
  echo "Backend:        $BACKEND_CHANGED"
  echo "Migrations:     $MIGRATIONS_CHANGED"
  echo "Infrastructure: $INFRASTRUCTURE_CHANGED"
}
