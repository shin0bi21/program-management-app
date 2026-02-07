# Youth Services Application - Backend

Express + TypeScript + PostgreSQL backend with comprehensive security features.

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
npm test
npm run test:watch
npm run test:coverage

# Database migrations
npm run db:migrate
npm run db:migrate:dry
npm run db:status
npm run db:generate-backup

# Type checking
npm run typecheck
```

## Architecture

- **Pure PostgreSQL** - Direct SQL with postgres.js driver (no ORM overhead)
- **Native tracking** - schema_migrations table in database
- **Type generation** - kysely-codegen creates TypeScript types automatically
- **Typed SQL rows** - Generated DB types + camelCase mapping for result shapes
- **Forward-only** - No rollbacks, progressive migrations only
- **Base table pattern** - LIKE base_table for consistent audit columns

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

**1. Create admin user:**
```bash
# Set credentials in .env:
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=SecurePassword123!
ADMIN_FIRST_NAME=John
ADMIN_LAST_NAME=Doe

# Run seeding script:
npm run seed:admin
```

The script is idempotent - safe to run multiple times (won't duplicate).

**2. Verify admin login:**
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourcompany.com","password":"SecurePassword123!"}'
```

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
# Run all tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Structure
- **tests/shared/app.ts** - Express app factory shared by all suites
- **tests/shared/db.ts** - Database seed/cleanup helpers (`seedTestUser`, `deleteTestUser`)
- **tests/auth/auth.test.ts** - Full auth flow (login, 2FA verify, resend, refresh, logout, password-reset)
- **tests/auth/helpers.ts** - Auth-specific helpers (trusted devices, 2FA codes, tokens, cookies)
- **tests/users/users.test.ts** - User CRUD operations, permissions, and validation
- **tests/users/helpers.ts** - User-specific helpers (token generation with permission levels)
- **tests/setup.ts** - Test configuration and database cleanup

### Running Individual Suites
```bash
npm run test:auth    # Auth suite only
npm run test:users   # Users suite only
npm test             # All suites
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
- **bcrypt hashing** - 10 rounds with timing attack protection
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
- **bcrypt** 6.0.0 - Password hashing
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
| `test:coverage` | Run tests with coverage report 

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

```bash
# 1. Backup first
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 2. Preview
npm run db:migrate:dry

# 3. Apply
npm run db:migrate

# 4. Verify
npm run db:status
```
