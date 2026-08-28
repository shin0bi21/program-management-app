# shellcheck shell=bash

build_frontend_image() {
  echo ""
  echo "Building frontend/nginx image..."
  docker compose build nginx
}

build_backend_image() {
  echo ""
  echo "Building backend image..."
  docker compose build backend
}
