# shellcheck shell=bash
# Build application images before the deployment lifecycle replaces services.

# Build the production nginx/frontend image; build failures propagate to the deployment owner.
# Example: build_frontend_image
build_frontend_image() {
  echo ""
  echo "Building frontend/nginx image..."
  docker compose build nginx
}

# Build the production backend image before any database or service replacement.
# Example: build_backend_image
build_backend_image() {
  echo ""
  echo "Building backend image..."
  docker compose build backend
}
