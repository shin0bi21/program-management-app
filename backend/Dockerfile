# ── Shared base ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
# postgresql-client: psql used by update_schemas.ts migrations
# curl: healthcheck in docker-compose.prod.yml
RUN apk add --no-cache postgresql-client curl
WORKDIR /app

# ── Development stage ─────────────────────────────────────────────────────────
# Code and CMD are overridden by docker-compose.yml volume mounts + command.
FROM base AS dev
EXPOSE 5001
CMD ["tail", "-f", "/dev/null"]

# ── Build stage — compile TypeScript ─────────────────────────────────────────
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM base AS prod
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 5001
CMD ["npm", "start"]
