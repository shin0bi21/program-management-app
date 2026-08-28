# shellcheck shell=bash

deploy_backend() {
  require_database
  if [ "$MIGRATIONS_CHANGED" = true ]; then
    run_migration_flow
  else
    echo ""
    echo "No migration files changed; validating current migration status..."
    run_migration_status
  fi

  restart_backend
  run_backend_post_deploy
}

deploy_frontend() {
  restart_frontend
}

deploy_infrastructure() {
  echo ""
  echo "Infrastructure changed; running the full deployment flow."
  build_backend_image
  build_frontend_image
  run_migration_flow
  restart_backend
  run_backend_post_deploy
  restart_frontend
}

record_all_revisions() {
  write_revision backend "$TARGET_SHA"
  write_revision frontend "$TARGET_SHA"
  write_revision infrastructure "$TARGET_SHA"
}

deployment_complete() {
  echo ""
  echo "=========================================="
  echo "Deploy complete: $(git log -1 --oneline "$TARGET_SHA")"
  echo "=========================================="
}
