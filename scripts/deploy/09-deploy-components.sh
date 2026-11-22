# shellcheck shell=bash
# Coordinate image, migration, service, and revision phases selected by main.sh.

# Build both images, apply guarded migrations, then replace backend and nginx.
# Example: deploy_infrastructure
deploy_infrastructure() {
  echo ""
  echo "Infrastructure changed; running the full deployment flow."
  # 1. Build both artifacts before changing services or the database.
  build_backend_image
  build_frontend_image
  # 2. Validate and apply migrations before replacing backend and frontend services.
  run_migration_flow
  restart_backend
  restart_frontend
}

# Publish TARGET_SHA for every component after the complete deployment succeeds.
# Example: record_all_revisions
record_all_revisions() {
  write_revision backend "$TARGET_SHA"
  write_revision frontend "$TARGET_SHA"
  write_revision infrastructure "$TARGET_SHA"
}

# Print the successfully deployed target after required gates and markers complete.
# Example: deployment_complete
deployment_complete() {
  echo ""
  echo "=========================================="
  echo "Deploy complete: $(git log -1 --oneline "$TARGET_SHA")"
  echo "=========================================="
}

# Validate selected migration work before replacing and health-checking the backend.
# Example: deploy_backend # uses MIGRATIONS_CHANGED
deploy_backend() {
  # 1. Validate the database, applying migrations only when their files changed.
  require_database
  if [ "$MIGRATIONS_CHANGED" = true ]; then
    run_migration_flow
  else
    echo ""
    echo "No migration files changed; validating current migration status..."
    run_migration_status
  fi

  # 2. Replace the backend only after migration status succeeds.
  restart_backend
}

# Replace and verify nginx after its image has been built by the deployment owner.
# Example: deploy_frontend
deploy_frontend() {
  restart_frontend
}
