# Youth Services Application — Backend

Express + TypeScript + PostgreSQL backend for a youth services management system.

For the full-stack overview and request flow diagram see the [root README](../README.md).
For backend conventions (SQL patterns, route structure, error throwing) see [`.github/copilot-instructions.md`](../.github/copilot-instructions.md).

---

## Table of Contents

1. [What This Is](#1-what-this-is)
2. [Get Running](#2-get-running)
3. [Project Structure](#3-project-structure)
4. [API Reference](#4-api-reference)
5. [Database & Migrations](#5-database--migrations)
6. [Testing](#6-testing)
7. [Development Workflow](#7-development-workflow)
8. [Deployment](#8-deployment)
9. [Troubleshooting](#9-troubleshooting)
10. [Commands Reference](#10-commands-reference)
11. [Architecture Docs](#11-architecture-docs)

---

## 1. What This Is

A management system for organisations running youth programs.

| Role | Access |
|------|--------|
| `admin` | Full access — manage staff, create/edit all youth profiles |
| `staff` | View and create/edit youth profiles; cannot manage other staff |

See [docs/auth.md §3 RBAC Model](docs/auth.md#3-rbac-model) for the full permissions breakdown, how permissions flow into tokens, and where to add a new permission.

**Youth profiles are not login users.** They are data records (name, DOB, school, group, addresses, emergency contacts) that staff manage through the app.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Framework | Express 4.18.2 |
| Language | TypeScript 5.9.3 |
| Database | PostgreSQL 18 via postgres.js 3.4.8 |
| Auth | JWT (jsonwebtoken 9.0.3) + 2FA via email |
| Validation | Zod 4.3.6 |
| Testing | Jest 30.2.0 + Supertest 7.2.2 |
| Email | Nodemailer 7.0.12 |

### System Topology

```
[Browser / React app :5173]
        │  HTTP (proxied via Nginx in prod)
        ▼
[Express API :5001]  ←  postgres.js  →  [PostgreSQL :5432]
        │
  Docker network (all services in docker-compose.yml at project root)
```

---

## 2. Get Running

### Environment Variables

```bash
cp .env.example .env
```

Required:

```bash
# Database
DATABASE_URL=postgresql://user:pass@db:5432/dbname

# JWT
JWT_SECRET=your-secret-key-here
REFRESH_SECRET=your-refresh-secret-here

# Email (Gmail)
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@example.com

# App
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Admin seed (first-time only)
ADMIN_EMAIL=you@yourdomain.com
ADMIN_PASSWORD=StrongPasswordHere!
ADMIN_FIRST_NAME=Your
ADMIN_LAST_NAME=Name

# Security (optional — defaults to JWT_SECRET if not set)
LOG_HMAC_SECRET=your-independent-hmac-secret

# Google Sheets integration (optional — only needed for import/export scripts)
GOOGLE_SERVICE_ACCOUNT_JSON=<base64-encoded-service-account-json>
```

### First-Time Setup

```bash
docker compose up -d
docker compose exec backend npm run db:migrate
docker compose exec backend npm run seed:admin   # idempotent
```

### Daily Start

```bash
docker compose up -d
```

The dev server starts automatically inside the container.

---

## 3. Project Structure

```
backend/
├── docs/               # Architecture references (auth.md, db.md, errors.md)
├── src/
│   ├── index.ts        # Entry point — middleware, routes, server start
│   ├── controllers/    # HTTP layer — extract params, call service, send response
│   ├── services/       # Business logic and all SQL queries
│   ├── routes/         # Route definitions with middleware chains
│   ├── middleware/     # authenticateToken, requirePermission, rateLimiter, validateRequest
│   ├── validation/     # Zod schemas per domain
│   ├── db/             # postgres.js client + asTransactionSql() helper
│   ├── errors.ts       # AppError + subclasses + sendError()
│   ├── types/          # JWT payload types, generated DB schema, DbRow<T>
│   └── utils/          # requireEnv, emailService, deviceUtils
├── db/
│   ├── migrations/     # SQL files — YYYY-MM-DD_#_description.sql
│   └── scripts/        # Migration runner (update_schemas.ts), seed-admin, migration_status
└── tests/
    ├── shared/         # App factory + seedTestUser/deleteTestUser helpers
    ├── auth/           # 44 tests
    ├── staff/          # 15 tests
    ├── youth/          # 25 tests
    └── schools/        # schools tests
```

For middleware order, route patterns, error throwing, and "adding a new domain" see [`.github/copilot-instructions.md`](../.github/copilot-instructions.md).

---

## 4. API Reference

### Authentication — `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/login` | Email/password login — returns 2FA challenge |
| `POST` | `/verify` | Submit 2FA code — returns JWT access token + sets refresh cookie |
| `POST` | `/resend` | Resend 2FA code |
| `POST` | `/refresh` | Rotate refresh token — returns new access token |
| `POST` | `/logout` | Blacklist tokens, clear session cookie |
| `POST` | `/forgot-password` | Send password reset email |
| `POST` | `/reset-password` | Reset password via token |

### Staff — `/api/staff`

Protected. See [docs/auth.md §3 RBAC Model](docs/auth.md#3-rbac-model) for which roles hold each permission.

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/` | List all staff and admin users | `read:staff` |
| `POST` | `/` | Create a new staff user | `write:staff` |
| `PATCH` | `/:id` | Toggle staff status | `write:staff` |
| `DELETE` | `/:id` | Delete staff member | `write:staff` |

### Youth — `/api/youth`

Protected. See [docs/auth.md §3 RBAC Model](docs/auth.md#3-rbac-model) for which roles hold each permission.

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/` | List all youth profiles | `read:youth_profiles` |
| `GET` | `/?id=<uuid>` | Get a single youth profile with addresses and contacts | `read:youth_profiles` |
| `POST` | `/` | Create or update a youth profile (upsert by `id`) | `write:youth_profiles` |
| `PATCH` | `/:id` | Toggle youth active status | `write:youth_profiles` |

### Schools — `/api/schools`

Protected. See [docs/auth.md §3 RBAC Model](docs/auth.md#3-rbac-model) for which roles hold each permission.

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/` | List all schools | `read:schools` |
| `POST` | `/` | Create/update school | `write:schools` |
| `DELETE` | `/:id` | Delete school | `write:schools` |

### Public — `/api/public`

Unauthenticated homepage intake endpoints.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/cohort-interest` | Store a cohort signup submission. Requires `youthName`, `age`, and at least one of `email` or `phoneNumber`. |

### Cohort Interest — `/api/cohort-interest`

Protected. Intended for internal review of homepage signup submissions.

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| `GET` | `/` | List cohort interest submissions newest first | `read:settings` |

For the auth sequence diagram, token TTLs, refresh rotation, and reuse-detection see [docs/auth.md](docs/auth.md).

---

## 5. Database & Migrations

Migrations are plain `.sql` files in `db/migrations/`, named `YYYY-MM-DD_#_description.sql`. They run in filename order, each inside a single transaction with full rollback on error. Applied files are tracked with SHA-256 checksums — never edit an applied migration, create a new one instead.

### Commands

```bash
docker compose exec backend npm run db:migrate   # apply pending migrations + regenerate types
docker compose exec backend npm run db:status    # applied migrations + checksum status
```

For the ERD, base table pattern, audit/auth log architecture, and safety guarantees see [docs/db.md](docs/db.md).

---

## 6. Testing

Tests run **inside the Docker container**. Never run Jest locally against a remote DB. `DATABASE_URL` must be set (it is, via `docker-compose.yml`).

### Running Tests

From the project root (`my-webapp/`):

```bash
# All suites
bash scripts/tests/test-apis.sh

# Individual suites
bash scripts/tests/run-auth-tests.sh    # 44 tests
bash scripts/tests/run-staff-tests.sh   # 15 tests
bash scripts/tests/run-youth-tests.sh   # 25 tests
bash scripts/tests/run-schools-tests.sh  # 28 tests

# Or directly
docker compose exec backend npm run test:auth
docker compose exec backend npm run test:staff
docker compose exec backend npm run test:youth
docker compose exec backend npm run test:schools
docker compose exec backend npm run test:coverage
```

The helper scripts detect already-running containers and **will not tear them down** afterwards — your dev data is preserved.

### Test Structure

| File | Purpose |
|------|---------|
| `tests/shared/app.ts` | Express app factory used by all suites |
| `tests/shared/db.ts` | `seedTestUser`, `deleteTestUser` helpers |
| `tests/auth/auth.test.ts` | Login → 2FA → refresh → logout → password reset |
| `tests/auth/helpers.ts` | Trusted device tokens, 2FA codes, cookies |
| `tests/staff/users.test.ts` | Staff CRUD, permission checks, validation |
| `tests/staff/helpers.ts` | Token generation with permission levels |
| `tests/youth/youth.test.ts` | Youth CRUD, upsert, address/contact sync |
| `tests/youth/helpers.ts` | Token generation, `deleteTestYouth` cleanup |
| `tests/schools/schools.test.ts` | Schools CRUD, permission checks, validation |
| `tests/schools/helpers.ts` | Token generation, `deleteTestSchool` cleanup |

### Jest + Node16 Module Resolution

The backend uses `"moduleResolution": "node16"` in `tsconfig.json`. Under Node16, TypeScript requires explicit `.js` extensions on relative imports. `ts-jest` resolves tests against raw `.ts` source — so those `.js` extensions don't resolve at runtime inside Jest.

Fix: a `moduleNameMapper` entry in `jest.config.js` strips `.js` from any relative import path before Jest resolves it:

```js
moduleNameMapper: {
  '^(\\.{1,2}/.*)\\.js$': '$1',
},
```

See [ts-jest issue #4207](https://github.com/kulshekhar/ts-jest/issues/4207) for the original discussion.

### Writing a Test

```typescript
import request from 'supertest';
import { createApp } from '../shared/app';
import { seedTestUser, deleteTestUser } from '../shared/db';

const app = createApp();

describe('Feature Tests', () => {
  let user: { userId: string };

  beforeAll(async () => {
    user = await seedTestUser({ permission: 'staff' });
  });

  afterAll(async () => {
    await deleteTestUser(user.userId);
  });

  it('should do the thing', async () => {
    const res = await request(app)
      .get('/api/endpoint')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
```

---

## 7. Development Workflow

### Daily Loop

```bash
docker compose up -d                              # 1. start containers
# 2. edit code in src/, tests/, db/migrations/
docker compose exec backend npm run typecheck    # 3. type-check
bash scripts/tests/test-apis.sh                   # 4. run tests
docker compose exec backend npm run db:migrate   # 5. apply any new migrations
git add . && git commit -m "Description" && git push
```

### Debugging

The backend container runs with the Node.js inspector on port 9229.

1. Open Run and Debug panel (`Cmd+Shift+D`)
2. Select **"Docker: Debug Backend"** from the dropdown
3. Press `F5` to attach (or click the green ▶ play button)
4. Set breakpoints in `src/` — they'll pause on the next matching request

> **Source maps:** `tsconfig.json` must include `"sourceMap": true`. Without it, breakpoints in service files will be silently skipped. After a `tsconfig.json` change, run `docker compose restart backend` then re-attach.

---

## 8. Deployment

Deployments are triggered automatically via CI on pushes to `main`.

### Automated Flow

```
push to main → CI (typecheck + test + build) → deploy job → SSH into server → ./scripts/deploy.sh
```

`scripts/deploy.sh` (project root) handles the full deploy:
1. `git reset --hard origin/main` — pull latest code
2. Build frontend (`docker run node:20-alpine npm ci && npm run build`)
3. Take a verified gzipped DB snapshot
4. Build new backend image (`docker compose -f docker-compose.prod.yml build`)
5. Run `db:migrate` from the new image
6. `docker compose -f docker-compose.prod.yml up -d`
7. Wait for backend healthcheck
8. On any failure after step 3: automatically restore DB from snapshot

### Manual Deployment Flow

If a push to `main` does not deploy cleanly:

```bash
ssh -i ~/.ssh/be-original-key.pem ubuntu@18.216.104.46
cd ~/my-webapp
./scripts/deploy.sh
```

### Updating Expired GitHub Token

If `./scripts/deploy.sh` fails at `git fetch origin main` with:

```text
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed for 'https://github.com/...'
```

the server repo is using HTTPS auth with an expired GitHub token.

Fix it on the Lightsail server:

```bash
cd /path/to/my-webapp

# Keep the remote clean — no token in the URL
git remote set-url origin https://github.com/shin0bi21/be-original.git

# Store the new token for HTTPS git auth
git config --global credential.helper store
printf "https://YOUR_GITHUB_USERNAME:YOUR_NEW_FULL_TOKEN@github.com\n" > ~/.git-credentials
chmod 600 ~/.git-credentials

# Verify and test
git remote -v
git fetch origin main
```

Notes:
- `git remote -v` should show `https://github.com/shin0bi21/be-original.git` with no token embedded.
- If the old token was exposed in shell history, logs, or chat, revoke it in GitHub immediately.
- Long-term, SSH deploy keys are cleaner than HTTPS + PAT on a server.

### First-Time Server Setup

Run once on the Lightsail server before the first deploy:

```bash
# Install Docker
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER

# Clone repo and configure
git clone <repo-url> /path/to/my-webapp && cd /path/to/my-webapp
cp .env.example .env   # fill in all required vars

# Issue SSL cert (port 80 must be free — Docker not started yet)
sudo apt install -y certbot
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Replace domain placeholder in nginx.conf
sed -i 's/your-domain.com/yourdomain.com/g' nginx.conf

# Create webroot dir for cert renewals
sudo mkdir -p /var/www/certbot

# First start + run migrations + seed admin
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec backend npm run db:migrate
docker compose -f docker-compose.prod.yml exec backend npm run seed:admin

# Switch certbot renewal to webroot (nginx now running) and set up cron
sudo certbot certonly --webroot -w /var/www/certbot \
  -d yourdomain.com -d www.yourdomain.com --force-renewal
echo "0 3 * * * root certbot renew --quiet && docker exec myapp_nginx nginx -s reload" \
  | sudo tee /etc/cron.d/certbot-renew
```

### GitHub Secrets Required

| Secret | Value |
|--------|-------|
| `LIGHTSAIL_HOST` | Server IP |
| `LIGHTSAIL_USER` | SSH user (e.g. `ubuntu`) |
| `LIGHTSAIL_SSH_KEY` | Private key (`-----BEGIN...-----END...`) |
| `LIGHTSAIL_APP_PATH` | Absolute path to repo on server |

Do not re-run `seed:admin` on subsequent deploys.

---

## 9. Troubleshooting

### "Checksum mismatch"

A migration file was modified after being applied. Never edit applied migrations — create a new one instead.

### "Advisory lock timeout"

Another migration process is still running. Wait, or check:

```sql
SELECT * FROM pg_locks WHERE locktype = 'advisory';
```

### Connection issues

1. Check `DATABASE_URL` in `.env`
2. Verify the container is up: `docker ps`
3. Check container logs: `docker logs myapp_db`

### Deploy fails with "Invalid username or token"

The server's GitHub HTTPS credential is stale or invalid. Follow [Server GitHub Token Refresh](#server-github-token-refresh).

### Tests fail with "relation does not exist"

The test DB is in a bad state. Reset it:

```bash
bash scripts/reset-dev-stack.sh
```

---

## 10. Commands Reference

All `npm run` commands execute inside the Docker container via `docker compose exec backend npm run <command>`.

| Command | Description |
|---------|-------------|
| `dev` | Start development server with ts-node |
| `build` | Compile TypeScript to JavaScript |
| `start` | Run compiled JavaScript |
| `typecheck` | Validate TypeScript without emitting |
| `test` | Run all test suites |
| `test:auth` | Auth test suite only |
| `test:staff` | Staff test suite only |
| `test:youth` | Youth test suite only |
| `test:schools` | Schools test suite only |
| `test:watch` | Run tests in watch mode |
| `test:coverage` | Run tests with coverage report |
| `db:migrate` | Apply pending migrations + regenerate types |
| `db:status` | Show applied migrations + checksum status |
| `db:types` | Regenerate TypeScript types from DB schema |
| `seed:admin` | Seed the admin user (idempotent) |

---

## 11. Architecture Docs

| File | Covers |
|------|--------|
| [docs/auth.md](docs/auth.md) | JWT payload types, token signing, refresh rotation, blacklist design, **RBAC model, roles & permissions**, auth logging, staff invite flow, full sequence diagram |
| [docs/db.md](docs/db.md) | Migration system, ERD, base table pattern, audit log, auth log, safety guarantees |
| [docs/errors.md](docs/errors.md) | AppError hierarchy, errorHandler, request flow, response shape |
| [docs/google-sheets.md](docs/google-sheets.md) | Service account setup, `readSheet` / `writeSheet` / `appendToSheet` API, smoke test, script pattern |
| [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) | File locations, route patterns, conventions, "adding a new domain" checklist |
