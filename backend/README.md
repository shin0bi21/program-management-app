# Youth Services Application — Backend

Express + TypeScript + PostgreSQL API for the youth services application.

## Documentation

| Area | Canonical document |
|---|---|
| Backend architecture | [`../docs/architecture/backend.md`](../docs/architecture/backend.md) |
| Authentication and permissions | [`../docs/architecture/auth.md`](../docs/architecture/auth.md) |
| Database and migrations | [`../docs/architecture/database.md`](../docs/architecture/database.md) |
| Error handling | [`../docs/architecture/errors.md`](../docs/architecture/errors.md) |
| Full HTTP lifecycle | [`../docs/architecture/http.mmd`](../docs/architecture/http.mmd) |
| Development handbook | [`../docs/development/README.md`](../docs/development/README.md) |
| Local setup | [`../docs/operations/setup.md`](../docs/operations/setup.md) |
| Local development | [`../docs/operations/local-development.md`](../docs/operations/local-development.md) |
| Testing | [`../docs/operations/testing.md`](../docs/operations/testing.md) |
| Deployment | [`../docs/operations/deployment.md`](../docs/operations/deployment.md) |
| Google Sheets scripts | [`docs/google-sheets.md`](docs/google-sheets.md) |

Repository-wide implementation invariants and documentation routing begin in [`../AGENTS.md`](../AGENTS.md).

## Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js 24+ |
| Framework | Express 4.18.2 |
| Language | TypeScript 5.9.3 |
| Database | PostgreSQL 18 with postgres.js 3.4.8 |
| Authentication | JWT and email 2FA |
| Validation | Zod 4.3.6 |
| Testing | Jest 30.2.0 and Supertest 7.2.2 |
| Email | Nodemailer 7.0.12 |

## API reference

Paths below are relative to `/api`. Protected endpoints require the permissions shown in the route source and summarized in the [RBAC model](../docs/architecture/auth.md#3-rbac-model).

### Authentication — `/auth`

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/login` | Validate credentials and begin 2FA or trusted-device login |
| `POST` | `/verify` | Verify 2FA and issue the session |
| `POST` | `/resend` | Resend a 2FA code |
| `POST` | `/refresh` | Rotate the refresh token and issue an access token |
| `POST` | `/logout` | Revoke the session and clear its cookie |
| `POST` | `/forgot-password` | Send a password-reset email |
| `POST` | `/reset-password` | Reset a password or activate an invited account |

### Accounts — `/accounts`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | List policy-scoped accounts |
| `POST` | `/` | Invite or update an account |
| `PATCH` | `/:id` | Change account status |
| `DELETE` | `/:id` | Revoke a pending invitation |

### Timesheets — `/time-entries`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | List time-entry resources and entries for a date range |
| `GET` | `/list` | List cursor-paginated, policy-scoped time entries |
| `GET` | `/options` | List readable staff resources and programs |
| `GET` | `/overview` | Get cycle-based pay-period and biweekly dashboard data for one staff member |
| `GET` | `/sessions` | List assigned sessions available for time entry |
| `POST` | `/` | Create a time entry |
| `PUT` | `/:id` | Update a time entry |
| `PATCH` | `/:id/placement` | Move a time entry to another work date without replacing unrelated fields |
| `DELETE` | `/:id` | Delete a time entry |

Staff writes are self-scoped while reads include policy-visible coworker resources; administrators can manage entries for active staff and administrators.

Time-entry validation, policies, services, and `backend/tests/timesheets/` are authoritative for entry, cycle, task-integration, and resource-scope behavior.

### Assigned tasks — `/tasks`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | List active assigned tasks, optionally filtered by staff and category |
| `GET` | `/list` | List cursor-paginated, policy-scoped tasks |
| `GET` | `/options` | List readable staff resources and programs |
| `POST` | `/` | Create a task with one required policy-scoped `staffId` owner |
| `PUT` | `/:id` | Update policy-scoped task details, status, dates, and owner |
| `PATCH` | `/:id/placement` | Move or resize a task without replacing unrelated task fields |
| `PATCH` | `/:id/status` | Update an assigned task's status |
| `DELETE` | `/:id` | Delete a policy-scoped task without logged time |

Task validation, policies, services, and `backend/tests/tasks/` are authoritative for lifecycle, assignment, placement, deletion, time-entry integration, and resource-scope behavior.

### Youth — `/youth`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | List youth or retrieve one profile with `?id=<uuid>` |
| `POST` | `/` | Create or update a youth profile |
| `PATCH` | `/:id` | Change youth status |
| `POST` | `/:id/invite` | Invite a youth account |
| `GET` | `/:id/cohorts/:cohortId/attendance` | Read youth-centric cohort attendance |
| `PUT` | `/:id/cohorts/:cohortId/attendance` | Replace youth-centric cohort attendance |
| `GET/POST` | `/:id/notes` | List or create youth profile notes |
| `PUT/DELETE` | `/:id/notes/:noteId` | Update or delete a youth profile note |

### Programming

| Base path | Purpose |
|---|---|
| `/programs` | Program lookup and creation |
| `/cohorts` | Cohorts, enrollments, sessions, attendance, reports, notes, and attachments |
| `/schools` | School lookup and management |

### Outreach

| Base path | Purpose |
|---|---|
| `/public` | Unauthenticated homepage content and expression-of-interest intake |
| `/expressions-of-interest` | Internal review, status updates, and lead conversion |
| `/leads` | Lead intake, status, notes, and youth signup |

Route files under `src/routes/` are the source of truth for exact paths, validation, and required permissions.

## Operations

- Use [`../docs/operations/local-development.md`](../docs/operations/local-development.md) for backend restarts, environment changes, migrations, database types, logs, debugging, and resets.
- Use [`../docs/operations/testing.md`](../docs/operations/testing.md) for full, backend-only, and focused test commands.
- Use [`../docs/operations/deployment.md`](../docs/operations/deployment.md) for CI, production deployment, monitoring, and production troubleshooting.
