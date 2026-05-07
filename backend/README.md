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

**Youth profiles are not login users.** They are data records (name, DOB, school, group, addresses, emergency contacts) that staff manage through the app.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20+ |
| Framework | Express 4.18.2 |
| Language | TypeScript 5.9.3 |
| Database | PostgreSQL 15+ via postgres.js 3.4.8 |
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
```

### First-Time Setup

```bash
docker-compose up -d
docker-compose exec backend npm run db:migrate
docker-compose exec backend npm run seed:admin   # idempotent
```

### Daily Start

```bash
docker-compose up -d
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
│   ├── errors/         # AppError + subclasses + sendError()
│   ├── types/          # JWT payload types, generated DB schema, DbRow<T>
│   └── utils/          # requireEnv, emailService, deviceUtils
├── db/
│   ├── migrations/     # SQL files — YYYY-MM-DD_#_description.sql
│   └── scripts/        # Migration runner, seed-admin, type generation
└── tests/
    ├── shared/         # App factory + seedTestUser/deleteTestUser helpers
    ├── auth/           # 44 tests
    ├── staff/          # 15 tests
    └── youth/          # 25 tests
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

Requires `admin` or `staff` token.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List all staff and admin users |
| `POST` | `/` | Create a new staff user (admin only) |

### Youth — `/api/youth`

Requires `admin` or `staff` token.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List all youth profiles |
| `GET` | `/?id=<uuid>` | Get a single youth profile with addresses and contacts |
| `POST` | `/` | Create or update a youth profile (upsert by `id`) |

### Schools — `/api/schools`

Requires `admin` or `staff` token.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List all schools |

For the auth sequence diagram, token TTLs, refresh rotation, and reuse-detection see [docs/auth.md](docs/auth.md).

---

## 5. Database & Migrations

Migrations are plain `.sql` files in `db/migrations/`, named `YYYY-MM-DD_#_description.sql`. They run in filename order, each inside a single transaction with full rollback on error. Applied files are tracked with SHA-256 checksums — never edit an applied migration, create a new one instead.

### Commands

```bash
docker-compose exec backend npm run db:migrate:dry       # preview — no changes applied
docker-compose exec backend npm run db:migrate           # apply pending migrations
docker-compose exec backend npm run db:status            # applied migrations + checksum status
docker-compose exec backend npm run db:generate-backup   # generate backup tables + triggers
```

For the ERD, base table pattern, backup architecture, and safety guarantees see [docs/db.md](docs/db.md).

---

## 6. Testing

Tests run **inside the Docker container**. Never run Jest locally against a remote DB. `DATABASE_URL` must be set (it is, via `docker-compose.yml`).

### Running Tests

From the project root (`my-webapp/`):

```bash
# All suites
bash scripts/test-apis.sh

# Individual suites
bash scripts/run-auth-tests.sh    # 44 tests
bash scripts/run-staff-tests.sh   # 15 tests
bash scripts/run-youth-tests.sh   # 25 tests

# Or directly
docker-compose exec backend npm run test:auth
docker-compose exec backend npm run test:staff
docker-compose exec backend npm run test:youth
docker-compose exec backend npm run test:coverage
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
docker-compose up -d                              # 1. start containers
# 2. edit code in src/, tests/, db/migrations/
docker-compose exec backend npm run typecheck    # 3. type-check
bash scripts/test-apis.sh                         # 4. run tests
docker-compose exec backend npm run db:migrate   # 5. apply any new migrations
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

### First-Time Deploy

```bash
# Set admin credentials in the server's .env first
docker-compose up -d
docker-compose exec backend npm run db:migrate
docker-compose exec backend npm run seed:admin
```

Admin credentials come from `.env`. Never expose admin creation through an API endpoint.

### Subsequent Deploys (with Schema Changes)

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql       # 1. backup first
docker-compose exec backend npm run db:migrate:dry        # 2. preview
docker-compose exec backend npm run db:migrate            # 3. apply
docker-compose exec backend npm run db:status             # 4. verify
```

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

### Tests fail with "relation does not exist"

The test DB is in a bad state. Reset it:

```bash
bash scripts/reset-dev-stack.sh
```

---

## 10. Commands Reference

All `npm run` commands execute inside the Docker container via `docker-compose exec backend npm run <command>`.

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
| `test:watch` | Run tests in watch mode |
| `test:coverage` | Run tests with coverage report |
| `db:migrate` | Apply pending migrations + regenerate types |
| `db:migrate:dry` | Preview pending migrations without applying |
| `db:status` | Show applied migrations + checksum status |
| `db:generate-backup` | Generate backup tables + triggers |
| `db:types` | Regenerate TypeScript types from DB schema |
| `seed:admin` | Seed the admin user (idempotent) |

---

## 11. Architecture Docs

| File | Covers |
|------|--------|
| [docs/auth.md](docs/auth.md) | JWT payload types, token signing, refresh rotation, blacklist design, RBAC, full sequence diagram |
| [docs/db.md](docs/db.md) | Migration system, ERD, base table pattern, backup architecture, safety guarantees |
| [docs/errors.md](docs/errors.md) | AppError hierarchy, errorHandler, request flow, response shape |
| [`.github/copilot-instructions.md`](../.github/copilot-instructions.md) | File locations, route patterns, conventions, "adding a new domain" checklist |
