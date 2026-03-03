# Youth Services Application - Backend

Express + TypeScript + PostgreSQL backend for a youth services management system.

---

## For AI Agents — Project Context

> **Read this section first.** It gives the full picture of what this app is, how it's structured, and what conventions to follow when making changes.

### What This App Is

A management system for organisations running youth programs. It has two types of human users:

| Role | Access |
|------|--------|
| `admin` | Full access — can manage staff, create/edit all youth profiles |
| `staff` | Can view and create/edit youth profiles; cannot manage other staff |

Youth profiles are **not login users** — they are data records (name, DOB, school, group, addresses, emergency contacts).

### Architecture at a Glance

```
[Browser / React app :5173]
        │  HTTP (proxied via Nginx in prod)
        ▼
[Express API :5001]  ←  postgres.js  →  [PostgreSQL :5432]
        │
  Docker network (all services defined in docker-compose.yml at project root)
```

### Domain Model

| Table | Purpose |
|-------|---------|
| `users` | Admin and staff accounts (login users) |
| `user_credentials` | Hashed passwords, 2FA codes, device fingerprints |
| `user_groups` | Groups that staff/youth belong to |
| `youth_profiles` | Youth data records (no login) |
| `addresses` | Addresses linked to youth via `youth_addresses` junction |
| `contacts` | Emergency contacts linked via `youth_contacts` junction |
| `schools` | School lookup table |
| `schema_migrations` | Tracks applied migration files + SHA-256 checksums |

### Key Conventions

- **DB uses `snake_case`**, TypeScript uses `camelCase` — handled automatically by `DbRow<T>` (see Architecture section)
- **Never alias SQL columns** to produce camelCase (`first_name AS "firstName"` is wrong — omit the alias)
- **No ORM** — raw SQL via postgres.js
- **All protected routes** require `authenticateToken` + `requirePermission` middleware
- **Tests run inside Docker** — never run Jest locally against a remote DB
- **Migrations are forward-only** — never modify an applied migration file

### Repo Info

- **GitHub**: `shin0bi21/be-original`, branch `1-user-setup`
- **Project root**: `my-webapp/` (contains `docker-compose.yml`)
- **Frontend README**: `frontend/README.md`
- **Backend README**: `backend/README.md` ← you are here

---

## Quick Start

```bash
# 1. Setup environment variables
cp .env.example .env
# Edit .env with your values (DB credentials, JWT secret, admin credentials)

# 2. Start services (Docker)
docker-compose up -d

# 3. Run migrations
npm run db:migrate

# 4. Seed admin user (first time only)
npm run seed:admin

# 5. Development
npm run dev

# Run tests
# Tests run inside the Docker container. From the project root (my-webapp/):

# Via helper scripts (recommended)
bash scripts/run-auth-tests.sh
bash scripts/run-staff-tests.sh
bash scripts/run-youth-tests.sh

# Or directly via docker-compose (from project root)
docker-compose exec backend npm run test:auth   # auth suite
docker-compose exec backend npm run test:staff  # staff suite
docker-compose exec backend npm run test:youth  # youth suite
docker-compose exec backend npm test            # all suites
docker-compose exec backend npm run test:coverage

# Database migrations
npm run db:migrate
npm run db:migrate:dry
npm run db:status
npm run db:generate-backup

# Type checking
npm run typecheck
```

## Project Structure

### Folder Layout

```
backend/
├── src/
│   ├── index.ts              # Express entry point (see below)
│   ├── controllers/
│   │   ├── authController.ts  # Login, 2FA verify/resend, refresh, logout, password reset
│   │   ├── staffController.ts # getStaff, createStaff
│   │   ├── youthController.ts # getYouth, setYouth (upsert), private setAddresses/setContacts
│   │   └── schoolController.ts# getSchools
│   ├── routes/
│   │   ├── authRoutes.ts      # Mounted at /api/auth
│   │   ├── staffRoutes.ts     # Mounted at /api/staff
│   │   ├── youthRoutes.ts     # Mounted at /api/youth
│   │   └── schoolRoutes.ts    # Mounted at /api/schools
│   ├── middleware/
│   │   ├── authMiddleware.ts  # authenticateToken (JWT verify + blacklist), requirePermission
│   │   ├── rateLimiter.ts     # 4-tier rate limiting (general, auth, strict, password-reset)
│   │   └── validateRequest.ts # Wraps Zod schema validation — call validateRequest(schema)
│   ├── validation/
│   │   ├── authSchemas.ts     # Zod schemas for auth endpoints
│   │   ├── staffSchemas.ts    # createStaffSchema
│   │   └── youthSchemas.ts    # setYouthSchema
│   ├── db/
│   │   └── client.ts          # postgres.js connection instance
│   ├── types/
│   │   ├── database.ts        # kysely-codegen generated types — mirrors DB schema in snake_case
│   │   └── db.ts              # DbRow<T> utility — converts snake_case keys → camelCase at type level
│   └── utils/
│       ├── emailService.ts    # Nodemailer transporter + sendEmail helper
│       └── deviceUtils.ts     # SHA-256 device fingerprint hashing
├── db/
│   ├── migrations/            # SQL migration files — YYYY-MM-DD_#_description.sql
│   └── scripts/               # Migration runner, seed-admin, type generation
└── tests/
    ├── shared/
    │   ├── app.ts             # Express app factory used by all test suites
    │   └── db.ts              # Seed/cleanup helpers (seedTestUser, deleteTestUser)
    ├── auth/                  # Auth test suite (44 tests)
    ├── staff/                 # Staff test suite (15 tests)
    └── youth/                 # Youth test suite (25 tests)
```

### `src/index.ts` — Entry Point

What it does, in order:

1. Load `.env` via `dotenv/config`
2. Create Express `app`
3. Apply global middleware: `helmet`, `cors` (origin: `FRONTEND_URL`), `express.json()`, `cookieParser()`
4. Mount `/health` → `{ status: 'ok' }`
5. Mount route groups: `/api/auth`, `/api/staff`, `/api/youth`, `/api/schools`
6. Start HTTP server on `PORT` (default `5001`)

### Request Lifecycle (Protected Route)

```
HTTP Request
  → Express router (e.g. staffRoutes.ts)
  → authenticateToken       — verify JWT signature, check blacklist
  → requirePermission(...)  — check user.permission against allowed roles
  → rateLimiter             — tier-specific (general / auth / strict / password-reset)
  → validateRequest(schema) — Zod parse; returns 400 with field errors on failure
  → controller              — SQL query via postgres.js → JSON response
```

### Adding a New Domain

To add a new route group (e.g. `/api/events`):

1. Create `src/validation/eventSchemas.ts` with Zod schemas
2. Create `src/controllers/eventController.ts` with handler functions
3. Create `src/routes/eventRoutes.ts` — apply middleware chain, call controllers
4. Mount in `src/index.ts`: `app.use('/api/events', eventRoutes)`
5. Mount the same routes in `tests/shared/app.ts` for test coverage
6. Create `tests/events/events.test.ts` and `tests/events/helpers.ts`
7. Add `"test:events": "jest --testPathPattern=tests/events"` to `package.json`

---

## Architecture

- **Pure PostgreSQL** - Direct SQL with postgres.js driver (no ORM overhead)
- **Native tracking** - schema_migrations table in database
- **Type generation** - kysely-codegen creates TypeScript types automatically
- **Typed SQL rows** - Generated DB types + automatic camelCase mapping for result shapes (see below)
- **Forward-only** - No rollbacks, progressive migrations only
- **Base table pattern** - LIKE base_table for consistent audit columns

## snake_case → camelCase Pattern

**This is a core design convention. Never break it.**

Database columns use `snake_case`. The `DbRow<T>` utility type in `src/types/db.ts` automatically converts them to `camelCase` at the TypeScript level via a recursive `CamelCase<S>` string type. postgres.js also returns column names as-is from the DB, and `DbRow` maps them.

### Rules

1. **DB columns always use `snake_case`** — `first_name`, `date_of_birth`, `grade_level`
2. **Never alias columns in SQL to produce camelCase** — do not write `first_name AS "firstName"`. `DbRow` handles it automatically.
3. **TypeScript interfaces mirror the DB** — in `src/types/database.ts`, use `snake_case` keys matching the column names exactly.
4. **Controllers/consumers use camelCase** — once typed through `DbRow<T>`, fields are accessed as `row.firstName`, `row.dateOfBirth`, `row.gradeLevel`.

### Example

```sql
-- DB column: grade_level SMALLINT
-- Correct — no alias needed
SELECT yp.grade_level FROM youth_profiles yp;

-- Wrong — never do this
SELECT yp.grade_level AS "gradeLevel" FROM youth_profiles yp;
```

```typescript
// database.ts — mirrors DB snake_case exactly
export interface YouthProfiles {
  grade_level: number | null;
}

// controller — DbRow<T> converts to camelCase automatically
type YouthRow = DbRow<Pick<YouthProfiles, 'grade_level'>>;
// → { gradeLevel: number | null }
```

## Migration Files

Location: `db/migrations/YYYY-MM-DD_#_description.sql`

### Creating New Tables

Use the base_table pattern:
```sql
-- Base columns: id, created_at, updated_at, created_by, updated_by
CREATE TABLE new_table (
  LIKE base_table INCLUDING ALL,
  custom_column VARCHAR(255) NOT NULL,
  -- your custom columns
);
```

### Example Migration
```sql
-- 2026-02-01_3_add_posts.sql
CREATE TABLE posts (
  LIKE base_table INCLUDING ALL, 
  title VARCHAR(255) NOT NULL,
  content TEXT,
  user_id UUID NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
```

## Safety Features

### Transaction Safety
- Single-transaction execution with automatic rollback on error

### Concurrency Protection
- Advisory locks prevent simultaneous migrations
- Lock ID: 123456789

### Checksum Validation
- SHA-256 hash stored for each migration
- Warns if applied migration file is modified

### Dry-Run Mode
```bash
npm run db:migrate:dry  # Preview without applying
```

## Workflow

### Initial Setup (First Deployment)

This runs once when the application is first deployed to a new environment (local or production). After this, the admin account persists and does not need to be re-created unless the database is wiped.

**1. Set admin credentials in `.env`:**
```bash
ADMIN_EMAIL=you@yourdomain.com
ADMIN_PASSWORD=StrongPasswordHere!
ADMIN_FIRST_NAME=Your
ADMIN_LAST_NAME=Name
```

**2. Run migrations:**
```bash
npm run db:migrate
```

**3. Seed the admin user:**
```bash
npm run seed:admin
```

The script is idempotent — re-running it on an existing admin is a no-op.

After this, the admin can log in via the application UI. No further seeding is required unless the database is fully reset.

### Creating Migrations

### 1. Create Migration
```bash
# Write SQL in: db/migrations/2026-02-01_3_add_feature.sql
```

### 2. Test Locally
```bash
npm run db:migrate:dry  # Preview
npm run db:migrate      # Apply
```

### 3. Generate Backups (if needed)
```bash
npm run db:generate-backup  # Auto-creates backup tables + triggers
npm run db:migrate          # Apply backup migration
```

### 4. Commit and Push
```bash
git add .
git commit -m "Add feature migration"
git push origin main
```

## Testing

Tests require `DATABASE_URL` to be set. Rate limiting is skipped when `NODE_ENV=test`.

### Running Tests
```bash
# All tests must run inside the Docker container, from the project root (my-webapp/)

# Via helper scripts (recommended)
bash scripts/run-auth-tests.sh
bash scripts/run-staff-tests.sh
bash scripts/run-youth-tests.sh

# Or directly via docker-compose
docker-compose exec backend npm test            # all suites
docker-compose exec backend npm run test:auth   # auth suite only
docker-compose exec backend npm run test:staff  # staff suite only
docker-compose exec backend npm run test:youth  # youth suite only
docker-compose exec backend npm run test:coverage
```

### Test Structure
- **tests/shared/app.ts** - Express app factory shared by all suites
- **tests/shared/db.ts** - Database seed/cleanup helpers (`seedTestUser`, `deleteTestUser`)
- **tests/auth/auth.test.ts** - Full auth flow (login, 2FA verify, resend, refresh, logout, password-reset)
- **tests/auth/helpers.ts** - Auth-specific helpers (trusted devices, 2FA codes, tokens, cookies)
- **tests/staff/users.test.ts** - Staff CRUD operations, permissions, and validation
- **tests/staff/helpers.ts** - Staff-specific helpers (token generation with permission levels)
- **tests/youth/youth.test.ts** - Youth CRUD operations, permissions, upsert, address/contact sync
- **tests/youth/helpers.ts** - Youth-specific helpers (token generation, `deleteTestYouth` cleanup)

### Running Individual Suites
```bash
# From project root (my-webapp/)
docker-compose exec backend npm run test:auth   # Auth suite
docker-compose exec backend npm run test:staff  # Staff suite
docker-compose exec backend npm run test:youth  # Youth suite
docker-compose exec backend npm test            # All suites
```

### Writing Tests
```typescript
import request from 'supertest';
import { createApp } from '../shared/app';
import { seedTestUser, deleteTestUser } from '../shared/db';

const app = createApp();

describe('Feature Tests', () => {
  afterAll(async () => {
    await deleteTestUser(user.userId);
  });

  it('should test feature', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send({ data: 'test' });

    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
  });
});
```

## Security Features

### Authentication & Authorization
- **JWT tokens** - Access (15min) + Refresh (7 days) with JTI tracking
- **2FA via email** - 6-digit codes with 5-minute expiry
- **Device fingerprinting** - SHA-256 hashed device identification
- **Trusted devices** - 30-day trust period for known devices
- **Refresh token rotation** - Automatic rotation with family tracking
- **Token reuse detection** - Revokes entire token family on breach
- **Session revocation** - Blacklist with in-memory caching (60s TTL)

### Input Validation
- **Zod schemas** - Type-safe validation for all endpoints
- **Rate limiting** - 4-tier system (general, auth, strict, password reset)
- **Account lockout** - 5 failed attempts = 15-minute lock

### Password Security
- **bcryptjs** - Password hashing (pure JS, 10 rounds, timing attack protection)
- **Reset tokens** - SHA-256 hashed, 1-hour expiry
- **Minimum length** - 8 characters enforced

## API Endpoints

### Authentication (`/api/auth`)
- `POST /login` - Email/password login, returns 2FA challenge
- `POST /verify` - Verify 2FA code, returns JWT tokens
- `POST /resend` - Resend 2FA code
- `POST /refresh` - Refresh access token
- `POST /logout` - Invalidate tokens and clear session
- `POST /forgot-password` - Request password reset email
- `POST /reset-password` - Reset password with token

### Staff (`/api/staff`) — requires `admin` or `staff` token
- `GET /` - List all staff and admin users
- `POST /` - Create a new staff user (admin only)

### Youth (`/api/youth`) — requires `admin` or `staff` token
- `GET /` - List all youth profiles
- `GET /?id=<uuid>` - Get a single youth profile
- `POST /` - Create or update a youth profile (upsert by `id`)

### Schools (`/api/schools`) — requires `admin` or `staff` token
- `GET /` - List all schools

## Development Workflow

### Debugging

The backend runs with Node.js debugger enabled on port 9229.

**To debug:**
1. Press `Cmd+Shift+D` (or `Ctrl+Shift+D` on Windows/Linux) to open Run and Debug panel
2. Select your debug configuration from the dropdown
3. Press `F5` to attach the debugger
4. Set breakpoints in your code (click in the gutter left of line numbers)
5. Make a request to trigger your breakpoint

The debugger will pause execution and let you inspect variables, step through code, and evaluate expressions.

### 1. Setup
```bash
docker-compose up -d
docker-compose exec backend npm run db:migrate
```

### 2. Make Changes
- Edit code in `src/`
- Add tests in `tests/`
- Create migrations in `db/migrations/`

### 3. Test
```bash
docker-compose exec backend npm test
docker-compose exec backend npm run typecheck
```

### 4. Database Changes
```bash
docker-compose exec backend npm run db:migrate:dry  # Preview
docker-compose exec backend npm run db:migrate      # Apply
docker-compose exec backend npm run db:generate-backup  # If needed
```

### 5. Commit
```bash
git add .
git commit -m "Description of changes"
git push
```

## Environment Variables
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
```

## Tech Stack

### Core
- **Express** 4.18.2 - Web framework
- **TypeScript** 5.9.3 - Type safety
- **Node.js** 20+ - Runtime

### Database
- **PostgreSQL** 15+ - Database with transactional DDL
- **postgres.js** 3.4.8 - Fast PostgreSQL driver (~50KB)
- **kysely-codegen** 0.19.0 - Type generation from schema

### Security
- **bcryptjs** 2.4.3 - Password hashing (pure JS, Alpine-compatible)
- **jsonwebtoken** 9.0.3 - JWT authentication
- **express-rate-limit** 8.2.1 - Rate limiting
- **zod** 4.3.6 - Input validation

### Testing
- **Jest** 30.2.0 - Test runner
- **Supertest** 7.2.2 - HTTP assertions
- **ts-jest** 29.4.6 - TypeScript support

### Email
- **Nodemailer** 7.0.12 - Email delivery

## Commands

| Command | Description |
|---------|-------------|
| `dev` | Start development server with ts-node |
| `build` | Compile TypeScript to JavaScript |
| `start` | Run compiled JavaScript |
| `test` | Run all tests |
| `test:watch` | Run tests in watch mode |
| `test:coverage` | Run tests with coverage report |
| `db:migrate` | Apply pending migrations and generate types |
| `db:migrate:dry` | Preview without applying changes |
| `db:status` | Show migration status and checksums |
| `db:generate-backup` | Generate backup infrastructure |
| `db:types` | Regenerate TypeScript types |
| `typecheck` | Validate TypeScript |

## Backup System

Auto-generates for each data table:
- `{table}_backup` - Backup table with all columns + metadata
- BEFORE INSERT trigger - Tracks new records
- BEFORE UPDATE trigger - Saves old values before changes
- BEFORE DELETE trigger - Archives deleted records

**Excluded from backups:**
- base_table (template only)
- Lookup tables (user_permissions, user_groups, etc.)
- Security tables (user_credentials, password_reset_tokens)
- System tables (schema_migrations, schema_backup_tracking)

## Troubleshooting

### "Checksum mismatch"
Migration file changed after being applied. Never modify applied migrations - create a new one instead.

### "Advisory lock timeout"
Another migration is running. Wait or check: `SELECT * FROM pg_locks WHERE locktype = 'advisory'`

### Connection issues
Check `DATABASE_URL` in `.env`, verify container with `docker ps`, or check logs: `docker logs myapp_db`

## Production Deployment

### First-Time Deploy

Run this once when standing up the application on a new server.

```bash
# 1. SSH into the server or exec into the backend container
docker-compose exec backend sh

# 2. Run migrations
npm run db:migrate

# 3. Seed the admin user (one time only)
npm run seed:admin
```

Admin credentials come from the server's `.env` file (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). Only the person with server access should run this. Never expose admin creation through an API endpoint.

### Subsequent Deploys (Schema Changes)

For any deployment that includes new migrations:

```bash
# 1. Backup the database first
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 2. Preview what will be applied
npm run db:migrate:dry

# 3. Apply migrations
npm run db:migrate

# 4. Verify
npm run db:status
```

Do not re-run `seed:admin` on subsequent deploys — the admin account already exists.
