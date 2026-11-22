# shellcheck shell=bash
# Replace the selected service, identify its new container, then verify readiness.

# Recreate the backend and require the replacement container to become healthy.
# Example: restart_backend
restart_backend() {
  local old_id
  # 1. Replace only the backend and wait for its new container ID.
  old_id="$(docker compose ps -q backend 2>/dev/null || true)"
  docker compose up -d --no-deps --force-recreate backend
  wait_for_replacement backend "$old_id"

  # 2. Require Docker health to succeed before reporting the backend ready.
  echo "Waiting for backend to become healthy..."
  if ! timeout 60 bash -c "until docker inspect --format='{{.State.Health.Status}}' '$REPLACED_CONTAINER_ID' 2>/dev/null | grep -q 'healthy'; do sleep 2; done"; then
    echo "ERROR: Backend failed to become healthy within 60s" >&2
    docker logs --tail 50 "$REPLACED_CONTAINER_ID"
    exit 1
  fi
  echo "Backend is healthy."
}

# Find a new service container within the optional attempt bound; publish REPLACED_CONTAINER_ID.
# Example: wait_for_replacement backend "$old_id" 15
wait_for_replacement() {
  # 1. Retain the prior container ID so readiness cannot accept the old container.
  local service="$1"
  local old_id="$2"
  local attempts="${3:-15}"
  local container_id=""

  # 2. Wait within the retry bound for a different container ID.
  for _ in $(seq 1 "$attempts"); do
    container_id="$(docker compose ps -q "$service" 2>/dev/null || true)"
    if [ -n "$container_id" ] && [ "$container_id" != "$old_id" ]; then
      REPLACED_CONTAINER_ID="$container_id"
      return
    fi
    sleep 2
  done

  # 3. Fail deployment if no replacement appears within the allotted time.
  echo "ERROR: New $service container did not appear within $((attempts * 2))s" >&2
  exit 1
}

# Recreate nginx, then verify its running state, configuration, and built entry file.
# Example: restart_frontend
restart_frontend() {
  local old_id
  # 1. Replace nginx and wait for its new container ID.
  old_id="$(docker compose ps -q nginx 2>/dev/null || true)"
  docker compose up -d --no-deps --force-recreate nginx
  wait_for_replacement nginx "$old_id"

  # 2. Require the replacement container to remain running.
  if [ "$(docker inspect -f '{{.State.Running}}' "$REPLACED_CONTAINER_ID" 2>/dev/null || true)" != true ]; then
    echo "ERROR: New nginx container is not running" >&2
    docker logs --tail 50 "$REPLACED_CONTAINER_ID"
    exit 1
  fi

  # 3. Validate nginx configuration and the built frontend entry file.
  docker exec "$REPLACED_CONTAINER_ID" nginx -t
  docker exec "$REPLACED_CONTAINER_ID" test -s /usr/share/nginx/html/index.html
  echo "Frontend/nginx is running with a valid configuration and built index."
}
