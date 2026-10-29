# ── Shared base ──────────────────────────────────────────────────────────────
FROM node:24-alpine AS base
# postgresql18-client: psql used by update_schemas.ts migrations
# Pinned to major version 18 to match postgres:18-alpine server image.
# Bump this only when the server image is also bumped.
# curl: healthcheck in docker-compose.yml
RUN apk add --no-cache postgresql18-client curl
WORKDIR /app

# ── Development stage ─────────────────────────────────────────────────────────
# Code and CMD are overridden by docker-compose.yml volume mounts + command.
FROM base AS dev
EXPOSE 5001
CMD ["tail", "-f", "/dev/null"]

# ── Build stage — compile TypeScript ─────────────────────────────────────────
FROM base AS builder
COPY backend/package*.json ./
RUN npm ci
COPY tsconfig.base.json /tsconfig.base.json
COPY backend/. .
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM base AS prod
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/db/migrations ./dist/db/migrations
EXPOSE 5001
CMD ["npm", "start"]
