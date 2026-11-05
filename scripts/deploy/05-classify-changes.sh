# shellcheck shell=bash

classify_infrastructure_changes() {
  if [ -z "$INFRASTRUCTURE_REVISION" ]; then
    INFRASTRUCTURE_CHANGED=true
    return
  fi

  local path
  while IFS= read -r path; do
    case "$path" in
      .dockerignore|tsconfig.base.json|frontend/Dockerfile|frontend/.dockerignore|backend/Dockerfile|backend/.dockerignore|docker-compose.prod.yml|nginx.conf|scripts/deploy/*)
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

classify_changes() {
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

  if revision_changed "$BACKEND_REVISION" backend/db; then
    MIGRATIONS_CHANGED=true
  fi

  classify_infrastructure_changes
  if [ "$INFRASTRUCTURE_CHANGED" = true ]; then
    FRONTEND_CHANGED=true
    BACKEND_CHANGED=true
    MIGRATIONS_CHANGED=true
  fi
}

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
