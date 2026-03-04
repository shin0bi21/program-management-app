# Youth Services Application — Backend

Express + TypeScript + PostgreSQL backend for a youth services management system.

---

## Table of Contents

1. [What This Is](#1-what-this-is)
2. [Get Running](#2-get-running)
3. [Project Structure](#3-project-structure)
4. [How a Request Flows](#4-how-a-request-flows)
5. [Core Conventions](#5-core-conventions)
6. [Domain Model](#6-domain-model)
7. [API Reference](#7-api-reference)
8. [Security](#8-security)
9. [Database & Migrations](#9-database--migrations)
10. [Testing](#10-testing)
11. [Development Workflow](#11-development-workflow)
12. [Deployment](#12-deployment)
13. [Troubleshooting](#13-troubleshooting)
14. [Commands Reference](#14-commands-reference)

---

## 1. What This Is

A management system for organisations running youth programs. It has two types of human users:

| Role | Access |
|------|--------|
| `admin` | Full access — manage staff, create/edit all youth profiles |
| `staff` | Can view and create/edit youth profiles; cannot manage other staff |

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

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Required variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@db:5432/dbname

# JWT Secrets
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

# Admin seed (first-time setup only)
ADMIN_EMAIL=you@yourdomain.com
ADMIN_PASSWORD=StrongPasswordHere!
ADMIN_FIRST_NAME=Your
ADMIN_LAST_NAME=Name
```

### First-Time Setup

```bash
# 1. Start all services (Docker)
docker-compose up -d

# 2. Apply migrations
docker-compose exec backend npm run db:migrate

# 3. Seed the admin account (one time only)
docker-compose exec backend npm run seed:admin
```

The dev server starts automatically inside the container. The seed script is idempotent — re-running it on an existing admin is a no-op.

### Daily Start

```bash
docker-compose up -d
```

That's it — the dev server runs automatically inside the container.

---

## 3. Project Structure

```
backend/
├── src/
│   ├── index.ts                   # Express entry point — boots app, mounts routes
│   ├── controllers/
│   │   ├── authController.ts      # Login, 2FA verify/resend, refresh, logout, password reset
│   │   ├── staffController.ts     # getStaff, createStaff
│   │   ├── youthController.ts     # getYouth, setYouth (upsert), setAddresses, setContacts
│   │   └── schoolController.ts    # getSchools
│   ├── routes/
│   │   ├── authRoutes.ts          # Mounted at /api/auth
│   │   ├── staffRoutes.ts         # Mounted at /api/staff
│   │   ├── youthRoutes.ts         # Mounted at /api/youth
│   │   └── schoolRoutes.ts        # Mounted at /api/schools
│   ├── middleware/
│   │   ├── authMiddleware.ts      # authenticateToken (JWT verify + blacklist), requirePermission
│   │   ├── rateLimiter.ts         # 4-tier rate limiting (general, auth, strict, password-reset)
│   │   └── validateRequest.ts     # Wraps Zod schema validation — call validateRequest(schema)
│   ├── validation/
│   │   ├── authSchemas.ts         # Zod schemas for auth endpoints
│   │   ├── staffSchemas.ts        # createStaffSchema
│   │   └── youthSchemas.ts        # setYouthSchema
│   ├── db/
│   │   └── client.ts              # postgres.js connection instance
│   ├── types/
│   │   ├── database.ts            # kysely-codegen generated types — DB schema in snake_case
│   │   └── db.ts                  # DbRow<T> utility — converts snake_case keys → camelCase
│   └── utils/
│       ├── emailService.ts        # Nodemailer transporter + sendEmail helper
│       └── deviceUtils.ts         # SHA-256 device fingerprint hashing
├── db/
│   ├── migrations/                # SQL files — YYYY-MM-DD_#_description.sql
│   └── scripts/                   # Migration runner, seed-admin, type generation
└── tests/
    ├── shared/
    │   ├── app.ts                  # Express app factory shared by all test suites
    │   └── db.ts                   # seedTestUser, deleteTestUser helpers
    ├── auth/                       # 44 tests — login, 2FA, refresh, logout, password reset
    ├── staff/                      # 15 tests — CRUD, permissions, validation
    └── youth/                      # 25 tests — CRUD, upsert, address/contact sync
```

### Entry Point — `src/index.ts`

What it does, in order:

1. Load `.env` via `dotenv/config`
2. Create Express `app`
3. Apply global middleware: `helmet`, `cors` (origin: `FRONTEND_URL`), `express.json()`, `cookieParser()`
4. Mount `/health` → `{ status: 'ok' }`
5. Mount route groups: `/api/auth`, `/api/staff`, `/api/youth`, `/api/schools`
6. Start HTTP server on `PORT` (default `5001`)

---

## 4. How a Request Flows

Every protected API request passes through this chain in order:

```
HTTP Request
  → Express router          — matches route to handler file (e.g. staffRoutes.ts)
  → authenticateToken       — verify JWT signature, check blacklist
  → requirePermission(...)  — check user.permission against allowed roles
  → rateLimiter             — tier-specific (general / auth / strict / password-reset)
  → validateRequest(schema) — Zod parse; returns 400 with field errors on failure
  → controller              — SQL query via postgres.js → JSON response
```

Middleware is applied in route files, not globally. Each route explicitly lists which middleware it needs. This makes the chain visible and auditable.

### Adding a New Domain

To add a new route group (e.g. `/api/events`):

1. Create `src/validation/eventSchemas.ts` — Zod schemas
2. Create `src/controllers/eventController.ts` — handler functions
3. Create `src/routes/eventRoutes.ts` — apply middleware chain, call controllers
4. Mount in `src/index.ts`: `app.use('/api/events', eventRoutes)`
5. Mount the same routes in `tests/shared/app.ts` for test coverage
6. Create `tests/events/events.test.ts` and `tests/events/helpers.ts`
7. Add `"test:events": "jest --testPathPatterns=tests/events"` to `package.json`

---

## 5. Core Conventions

### No ORM — Raw SQL via postgres.js

All database queries are written as plain SQL. No Sequelize, Prisma, or TypeORM. This keeps queries transparent, predictable, and fast.

### snake_case → camelCase (Never Break This)

The DB uses `snake_case` columns. TypeScript uses `camelCase`. The `DbRow<T>` utility in `src/types/db.ts` converts between them at the type level automatically.

**Rules:**

1. **DB columns always use `snake_case`** — `first_name`, `date_of_birth`, `grade_level`
2. **Never alias SQL columns to produce camelCase** — `first_name AS "firstName"` is wrong. `DbRow` handles it.
3. **`src/types/database.ts` mirrors the DB** — use `snake_case` keys matching column names exactly
4. **Controllers use camelCase** — once typed through `DbRow<T>`, fields are `row.firstName`, `row.dateOfBirth`

```sql
-- Correct — no alias
SELECT yp.grade_level FROM youth_profiles yp;

-- Wrong — never do this
SELECT yp.grade_level AS "gradeLevel" FROM youth_profiles yp;
```

```typescript
// database.ts — snake_case mirrors DB exactly
export interface YouthProfiles {
  grade_level: number | null;
}

// controller — DbRow<T> does the conversion
type YouthRow = DbRow<Pick<YouthProfiles, 'grade_level'>>;
// → { gradeLevel: number | null }
```

### Migrations Are Forward-Only

Never modify an applied migration file. If you need to change something, create a new migration. The `schema_migrations` table stores a SHA-256 checksum for every applied file and will warn if a file is modified after apply.

### All Protected Routes Require Both Middleware

```typescript
router.get('/', authenticateToken, requirePermission('admin', 'staff'), handler);
```

Never skip either. Never check permissions manually inside a controller.

---

## 6. Domain Model

| Table | Purpose |
|-------|---------|
| `users` | Admin and staff accounts (the people who log in) |
| `user_credentials` | Hashed passwords, 2FA codes, device fingerprints, lockout state |
| `user_groups` | Groups that staff and youth belong to |
| `youth_profiles` | Youth data records — no login, managed by staff |
| `addresses` | Addresses linked to youth via `user_has_addresses` junction |
| `contacts` | Emergency contacts linked via `user_has_contacts` junction |
| `schools` | School lookup table |
| `schema_migrations` | Applied migration files + SHA-256 checksums |

Youth profiles carry: name, DOB, gender, school, group, grade level, addresses, and emergency contacts. All address and contact changes go through the youth upsert (`POST /api/youth`) which syncs junction tables atomically.

---

## 7. API Reference

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

---

## 8. Security

### Authentication Flow

1. `POST /login` — validates credentials, sends 2FA code via email
2. `POST /verify` — validates 2FA code, issues access token (1h) + refresh token (8h httpOnly cookie)
3. Subsequent requests — `Authorization: Bearer <access_token>` header
4. `POST /refresh` — rotates refresh token, issues new access token

Trusted devices skip step 2 (2FA bypassed for 30 days after first verify on that device).

### Token Security

| Feature | Detail |
|---------|--------|
| Access token TTL | 1 hour |
| Refresh token TTL | 8 hours |
| Refresh storage | httpOnly cookie (not accessible to JS) |
| JTI tracking | Every token has a unique ID for blacklisting |
| Refresh rotation | New token issued on every `/refresh` call |
| Reuse detection | Using a rotated-out token revokes the entire token family |
| Blacklist cache | In-memory, 60s TTL per entry |

### Rate Limiting (4 Tiers)

| Tier | Applied To | Strictness |
|------|-----------|------------|
| General | All protected routes (`/api/staff`, `/api/youth`, `/api/schools`) | Permissive |
| Auth | `/login`, `/refresh` | Strict |
| Strict | `/verify`, `/resend` | Very strict |
| Password reset | `/forgot-password`, `/reset-password` | Most strict |

Rate limiting is disabled when `NODE_ENV=test`.

### Other

- **Account lockout** — 5 failed login attempts = 15-minute lock
- **Password hashing** — bcryptjs, 10 rounds
- **Reset tokens** — SHA-256 hashed, 1-hour expiry
- **Device fingerprinting** — SHA-256 hashed, used for trusted device logic
- **Input validation** — Zod on every endpoint, 400 with field-level errors on failure

---

## 9. Database & Migrations

### Migration Files

Location: `db/migrations/YYYY-MM-DD_#_description.sql`

All migrations run in a single transaction with automatic rollback on error. Advisory locks prevent concurrent runs.

### Creating a New Migration

**Step 1 — Write the SQL file:**

```sql
-- db/migrations/2026-02-01_3_add_posts.sql

CREATE TABLE posts (
  LIKE base_table INCLUDING ALL,       -- includes id, created_at, updated_at, created_by, updated_by
  title VARCHAR(255) NOT NULL,
  content TEXT,
  user_id UUID NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
```

The `LIKE base_table INCLUDING ALL` pattern gives every table consistent audit columns. Always use it.

**Step 2 — Test locally:**

```bash
docker-compose exec backend npm run db:migrate:dry   # preview — no changes applied
docker-compose exec backend npm run db:migrate       # apply
docker-compose exec backend npm run db:status        # verify
```

**Step 3 — Generate backup infrastructure (if the table holds important data):**

```bash
docker-compose exec backend npm run db:generate-backup   # generates a new backup migration SQL file
docker-compose exec backend npm run db:migrate           # apply that file to create the backup tables + triggers
```

**Step 4 — Commit:**

```bash
git add .
git commit -m "Add posts migration"
git push origin main
```

### Safety Features

| Feature | Detail |
|---------|--------|
| Transaction safety | All statements in one transaction — error = full rollback |
| Concurrency | Advisory lock ID 123456789 prevents parallel runs |
| Checksum validation | SHA-256 per file — warns if an applied file is modified |
| Dry-run mode | `npm run db:migrate:dry` previews without applying |

### Backup System

`docker-compose exec backend npm run db:generate-backup` auto-generates for each data table:

- `{table}_backup` — backup table with all original columns + metadata
- `BEFORE INSERT` trigger — tracks new records
- `BEFORE UPDATE` trigger — saves old values before changes
- `BEFORE DELETE` trigger — archives deleted records

Tables excluded from backups: `base_table`, lookup tables, security tables (`user_credentials`, `password_reset_tokens`), and system tables (`schema_migrations`, `schema_backup_tracking`).

---

## 10. Testing

Tests run **inside the Docker container**. Never run Jest locally against a remote DB. `DATABASE_URL` must be set (it is, via `docker-compose.yml`).

### Running Tests

From the project root (`my-webapp/`):

```bash
# All suites via helper script (recommended)
bash scripts/test-apis.sh

# Individual suites
bash scripts/run-auth-tests.sh    # 44 tests
bash scripts/run-staff-tests.sh   # 15 tests
bash scripts/run-youth-tests.sh   # 25 tests

# Or directly via docker-compose
docker-compose exec backend npm run test:auth
docker-compose exec backend npm run test:staff
docker-compose exec backend npm run test:youth
docker-compose exec backend npm run test:coverage
```

The helper scripts detect if Docker containers are already running and **will not tear them down** after tests complete — your dev data is preserved.

### Test Structure

| File | Purpose |
|------|---------|
| `tests/shared/app.ts` | Express app factory — used by all suites |
| `tests/shared/db.ts` | `seedTestUser`, `deleteTestUser` helpers |
| `tests/auth/auth.test.ts` | Login → 2FA → refresh → logout → password reset |
| `tests/auth/helpers.ts` | Trusted device tokens, 2FA codes, cookies |
| `tests/staff/users.test.ts` | Staff CRUD, permission checks, validation |
| `tests/staff/helpers.ts` | Token generation with permission levels |
| `tests/youth/youth.test.ts` | Youth CRUD, upsert, address/contact sync |
| `tests/youth/helpers.ts` | Token generation, `deleteTestYouth` cleanup |

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

## 11. Development Workflow

### Daily Loop

```bash
# 1. Start containers
docker-compose up -d

# 2. Edit code in src/, tests/, db/migrations/

# 3. Type-check
docker-compose exec backend npm run typecheck

# 4. Run tests
bash scripts/test-apis.sh

# 5. Apply any new migrations
docker-compose exec backend npm run db:migrate

# 6. Commit
git add . && git commit -m "Description" && git push
```

### Debugging

The backend container runs with the Node.js inspector on port 9229.

1. Open the Run and Debug panel (`Cmd+Shift+D`)
2. Select your debug configuration from the dropdown
3. Press `F5` to attach
4. Set breakpoints in `src/` — they'll pause on the next matching request

---

## 12. Deployment

### First-Time Deploy

Run once when standing up the app on a new server.

```bash
# Set admin credentials in the server's .env before running

docker-compose up -d
docker-compose exec backend npm run db:migrate
docker-compose exec backend npm run seed:admin
```

Admin credentials come from `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, etc.). Never expose admin creation through an API endpoint.

### Subsequent Deploys (with Schema Changes)

```bash
# 1. Backup the database first
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 2. Preview what will be applied
docker-compose exec backend npm run db:migrate:dry

# 3. Apply
docker-compose exec backend npm run db:migrate

# 4. Verify
docker-compose exec backend npm run db:status
```

Do not re-run `seed:admin` on subsequent deploys.

---

## 13. Troubleshooting

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
bash scripts/reset-db.sh
```

---

## 14. Commands Reference

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


