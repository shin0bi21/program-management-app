# Copilot Instructions — Youth Services App


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

---

## Running Tests

**Full suite (default — always use this unless a specific suite is requested):**

```bash
./scripts/test-full-stack.sh
```

Individual suites (only when explicitly asked):

```bash
./scripts/backend/run-auth-tests.sh
./scripts/backend/run-accounts-tests.sh
./scripts/backend/run-youth-tests.sh
./scripts/backend/run-schools-tests.sh
./scripts/backend/run-outreach-tests.sh
```

**Frontend tests (Vitest + jsdom + Testing Library):**

```bash
cd frontend && npm test          # single run (same as CI)
cd frontend && npm run test:watch # watch mode for dev
```

## Shared Floating Menu System

All frontend dropdowns/flyouts use a shared 3-piece system. **Never build bespoke position, dismiss, or keyboard logic inside a component.**

| Piece | File | Role |
|---|---|---|
| Position util | `frontend/src/common/utils/floatingPosition.ts` | Pure function — `calculateFloatingPosition(anchor, placement, options)` → `{ top, left }`. Collision detection flips side/alignment automatically. |
| Hook | `frontend/src/common/hooks/useFloatingMenu.ts` | All behavior — state, position calc, outside-dismiss, scroll/resize close, focus management. Returns `{ isOpen, toggle, close, position, menuRef }`. |
| Component | `frontend/src/common/components/FloatingMenuPanel/` | Portal renderer (`createPortal` to `document.body`). Handles `Escape`/`Tab`/Arrow keyboard nav. |

---

## Production Deployment

**CI auto-deploys on push to `main`** via `.github/workflows/ci.yml` → `./scripts/deploy.sh` on Lightsail. `deploy.sh` snapshots the DB before migrating and auto-restores from that snapshot if the post-deploy health check fails.

---

## Context & File Rules

- **After a conversation summary or compaction, read the relevant files before editing** — never trust the summary alone for exact current content.
- **`src/types/auth.ts` is the single source of truth for token shapes and permission strings** — check it first for any auth-related change. Both `authService.ts` and `authMiddleware.ts` import from here.
- **Never edit an applied migration** — write a new file instead. Applied files are checksum-tracked; editing one aborts the next migrate run.
- **`escapeHtml()` is required on any user-supplied value interpolated into email HTML** — applies in `emailService.ts` and any new email helper.
- **Do not write change summaries after completing edits** — confirm done in one sentence. Only produce a summary when explicitly asked.

---

## Docs Index

| What | File |
|---|---|
| Full-stack overview | `README.md` |
| Frontend structure, patterns, floating menu system, tests | `frontend/STRUCTURE.md` |
| Frontend HTTP pipeline diagram | `frontend/docs/api-flow.mmd` |
| Backend auth architecture | `backend/docs/auth.md` |
| Backend error handling | `backend/docs/errors.md` |
| Database schema + migrations | `backend/docs/db.md` |
| Google Sheets integration | `backend/docs/google-sheets.md` |
| Backend setup + API reference + commands | `backend/README.md` |
| Security audit | `vulnerabilities.md` |
| Backend coding rules (file locations, patterns) | `.github/instructions/backend.instructions.md` |
| Frontend coding rules (file locations, patterns, floating menu, tests) | `.github/instructions/frontend.instructions.md` |
| Shell script rules | `.github/instructions/scripts.instructions.md` |
