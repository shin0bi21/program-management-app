# shellcheck shell=bash

wait_for_replacement() {
  local service="$1"
  local old_id="$2"
  local attempts="${3:-15}"
  local container_id=""

  for _ in $(seq 1 "$attempts"); do
    container_id="$(docker compose ps -q "$service" 2>/dev/null || true)"
    if [ -n "$container_id" ] && [ "$container_id" != "$old_id" ]; then
      REPLACED_CONTAINER_ID="$container_id"
      return
    fi
    sleep 2
  done

  echo "ERROR: New $service container did not appear within $((attempts * 2))s"
  exit 1
}

restart_backend() {
  local old_id
  old_id="$(docker compose ps -q backend 2>/dev/null || true)"
  docker compose up -d --no-deps --force-recreate backend
  wait_for_replacement backend "$old_id"

  echo "Waiting for backend to become healthy..."
  if ! timeout 60 bash -c "until docker inspect --format='{{.State.Health.Status}}' '$REPLACED_CONTAINER_ID' 2>/dev/null | grep -q 'healthy'; do sleep 2; done"; then
    echo "ERROR: Backend failed to become healthy within 60s"
    docker logs --tail 50 "$REPLACED_CONTAINER_ID"
    exit 1
  fi
  echo "Backend is healthy."
}

run_backend_post_deploy() {
  echo ""
  echo "Ensuring homepage image variants exist..."
  docker compose exec -T backend node dist/db/scripts/backfill-homepage-image-variants.js
}

restart_frontend() {
  local old_id
  old_id="$(docker compose ps -q nginx 2>/dev/null || true)"
  docker compose up -d --no-deps --force-recreate nginx
  wait_for_replacement nginx "$old_id"

  if [ "$(docker inspect -f '{{.State.Running}}' "$REPLACED_CONTAINER_ID" 2>/dev/null || true)" != true ]; then
    echo "ERROR: New nginx container is not running"
    docker logs --tail 50 "$REPLACED_CONTAINER_ID"
    exit 1
  fi

  docker exec "$REPLACED_CONTAINER_ID" nginx -t
  docker exec "$REPLACED_CONTAINER_ID" test -s /usr/share/nginx/html/index.html
  echo "Frontend/nginx is running with a valid configuration and built index."
}
