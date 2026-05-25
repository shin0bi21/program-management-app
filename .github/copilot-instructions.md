# Copilot Instructions — Youth Services App

Full-stack youth services management system.
**Stack:** React 18 + TypeScript + Vite (frontend) · Express 4 + TypeScript + postgres.js (backend) · PostgreSQL · Docker Compose.

> **Instruction stack — scoped coding rules (auto-loaded by Copilot)**
> - Backend: `.github/instructions/backend.instructions.md`
> - Frontend: `.github/instructions/frontend.instructions.md`
> - Scripts: `.github/instructions/scripts.instructions.md`

---

## Pinned Versions — DO NOT CHANGE

These are production-stable. Do not suggest, bump, or modify any of these without explicit user instruction:

| What | Pinned version |
|---|---|
| Node.js (Dockerfile + docker-compose.yml) | `node:20-alpine` |
| PostgreSQL server (docker-compose.yml + prod) | `postgres:18-alpine` |
| PostgreSQL client (Dockerfile `apk add`) | `postgresql18-client` |
| Express | `4.18.2` |
| TypeScript | `5.9.3` |
| ts-node | `10.9.2` |

The `postgresql18-client` version in the Dockerfile **must always match** the `postgres:X-alpine` server image version. Only bump both together, and only when explicitly asked.

---

## Repo Layout

```
my-webapp/
  backend/          Express API
  frontend/         React SPA
  scripts/          Shell scripts — deploy.sh, backup-db.sh, reset-dev-stack.sh
  scripts/tests/    Test runner scripts — run-auth-tests.sh, run-staff-tests.sh, run-youth-tests.sh
  docker-compose.yml
  nginx.conf
```

---

## Auth System Summary

Two JWTs with different secrets:
- **Access token** (`JWT_SECRET`, 1h) — sent as `Authorization: Bearer` header, not stored in DB (blacklisted on logout via `system_revoked_tokens`)
- **Refresh token** (`REFRESH_SECRET`, 8h) — sent as `httpOnly` cookie, stored hashed in `user_refresh_tokens` table

Login flow: `POST /auth/login` → credentials check → send 2FA email → `POST /auth/verify` → issue token pair.
Trusted devices skip 2FA for 30 days.
Refresh rotation: each `/auth/refresh` revokes old refresh token, issues new pair. Token reuse (presenting a rotated-out token) revokes the entire family → forced re-login.

Frontend session model: access token in localStorage → `apiClient` checks expiry before each call → proactive refresh at 10min before expiry (max once per 5min) → if expired, show `ReLoginModal` and suspend all in-flight requests → resolve all when user re-authenticates.

---

## Error Response Shape (always this, everywhere)

```ts
// Backend sends (AppError.ts ErrorResponse):
{ error: string; details?: { field: string; message: string }[]; requestId?: string }

// Frontend receives as (clientErrors.ts ApiError):
new ApiError(res.status, err.error, err.details, err.requestId)
```

---

## Key Conventions

- **snake_case** in SQL, **camelCase** in TypeScript — postgres.js handles the conversion
- **`requireEnv(name)`** for all env var access — throws at startup, never mid-request
- **`escapeHtml()`** on any user-supplied data interpolated into email HTML

---

## Dev Stack

To rebuild the local dev stack from scratch (stops containers, wipes volumes, rebuilds images, runs migrations on both dev + test DBs, seeds admin):

```bash
./scripts/reset-dev-stack.sh
```

Run this after pulling changes that include new migrations, or any time the stack is in a bad state.

---

## Running Tests

**Full suite (default — always use this unless a specific suite is requested):**

```bash
./scripts/tests/test-apis.sh    # runs all suites via docker compose exec backend npm test
```

Individual suites (only when explicitly asked):

```bash
./scripts/tests/run-auth-tests.sh    # 44 auth tests
./scripts/tests/run-staff-tests.sh   # 15 staff tests
./scripts/tests/run-youth-tests.sh   # 25 youth tests
./scripts/tests/run-schools-tests.sh  # schools tests
```

Frontend UI tests are not yet configured.

## Linting Shell Scripts

Before committing any `scripts/*.sh` file, run both checks:

```bash
bash -n scripts/deploy.sh      # syntax check — catches bad substitutions, mismatched braces
shellcheck scripts/deploy.sh   # semantic check — catches unquoted vars, bad redirects, etc.
```

They complement each other: `bash -n` catches what shellcheck misses and vice versa.
Install shellcheck with `brew install shellcheck`.

---

## Production Deployment

**Prod compose file:** `docker-compose.prod.yml` (project root) — backend `prod` target, nginx with SSL, db only. No dev services, no exposed DB/backend ports.

**Dockerfile:** Multi-stage — `dev` (tail -f, volumes from compose), `builder` (tsc compile), `prod` (production deps + compiled dist, `npm start`).

**nginx.conf:** Port 80 redirects to HTTPS. Port 443 with TLS 1.2/1.3, HSTS, security headers. ACME challenge path for certbot renewals.

**CI auto-deploy:** `.github/workflows/ci.yml` — on push to `main`, after backend + frontend jobs pass, SSHes into Lightsail and runs `./scripts/deploy.sh`. Requires 4 GitHub secrets: `LIGHTSAIL_HOST`, `LIGHTSAIL_USER`, `LIGHTSAIL_SSH_KEY`, `LIGHTSAIL_APP_PATH`.

**deploy.sh flow:**
1. `git reset --hard origin/main`
2. Build frontend via `docker run node:20-alpine`
3. DB snapshot (gzipped pg_dump, verified)
4. Build new backend image (`docker compose -f docker-compose.prod.yml build`)
5. Migrate from new image (`docker compose run --rm --no-deps backend`)
6. `docker compose -f docker-compose.prod.yml up -d`
7. Health check — on failure, auto-restores DB from snapshot

**`COMPOSE_FILE=docker-compose.prod.yml`** is exported at the top of `deploy.sh` — all `docker compose` calls in the script use it automatically.

---

## Docs Index

| What | File |
|---|---|
| Full-stack overview | `README.md` |
| Frontend structure, patterns, state architecture | `frontend/STRUCTURE.md` |
| Frontend HTTP pipeline diagram | `frontend/docs/api-flow.mmd` |
| Backend auth architecture | `backend/docs/auth.md` |
| Backend error handling | `backend/docs/errors.md` |
| Database schema + migrations | `backend/docs/db.md` |
| Backend setup + API reference + commands | `backend/README.md` |
| Security audit | `vulnerabilities.md` |
| Backend coding rules (file locations, patterns) | `.github/instructions/backend.instructions.md` |
| Frontend coding rules (file locations, patterns) | `.github/instructions/frontend.instructions.md` |
| Shell script rules | `.github/instructions/scripts.instructions.md` |
