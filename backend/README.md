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
| Local setup | [`../docs/local/setup.md`](../docs/local/setup.md) |
| Local development | [`../docs/local/development.md`](../docs/local/development.md) |
| Testing | [`../docs/testing.md`](../docs/testing.md) |
| Deployment | [`../docs/deployment.md`](../docs/deployment.md) |
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
| `GET` | `/cohorts` | List cohorts for a selected program |
| `POST` | `/` | Create a time entry |
| `PUT` | `/:id` | Update a time entry |
| `DELETE` | `/:id` | Delete a time entry |

Staff access is self-scoped; administrators can manage entries for active staff and administrators.

### Assigned tasks — `/tasks`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | List active assigned tasks, optionally filtered by staff and category |
| `GET` | `/options` | List assignable staff, programs, and program-scoped cycles |
| `POST` | `/` | Create a task with one required policy-scoped `staffId` owner |
| `PUT` | `/:id` | Update policy-scoped task details, status, dates, and owner |
| `PATCH` | `/:id/placement` | Move or resize a task without replacing unrelated task fields |
| `PATCH` | `/:id/status` | Update an assigned task's status |
| `DELETE` | `/:id` | Delete a policy-scoped task without logged time |

General time entries require `category` and `cycleId`; `programId` is optional. Task-linked time accepts an assigned `taskId` instead and derives its category, cycle, and optional program from that task inside the write transaction. Tasks referenced by time entries cannot be deleted, preserving their IDs and titles for reporting.
Staff timesheet reads are resource-scoped: coworkers who share any program assignment are visible as complete time-entry rows, including general and administrative time. This visibility does not grant mutation rights; staff writes remain self-scoped, while administrators may read and mutate every active staff resource. `staffResourcePolicy.ts` owns the shared read boundary; `timeEntryPolicy.ts` owns time-entry writes.
Task writes require `category`, `cycleId`, `startDate`, and `dueDate`; `programId` is optional. Dates use `YYYY-MM-DD`, with the due date on or after the start date. Planned task dates remain editable after time is logged, and task-linked time may be recorded before or after that planned range so later reporting can compare scheduled and actual work.
Creating or updating a time entry that references a to-do task moves that task to `in_progress` in the same transaction. An in-progress task cannot transition to `cancelled` through either the full update or status endpoint.
Only a to-do task without logged time can be reassigned to another staff member.
Staff task writes are self-scoped: they may create and mutate tasks assigned to themselves. Staff reads are resource-scoped: coworkers who share any program assignment are visible as complete task rows, including programless work, without granting write access. Administrators may read and mutate every active staff resource. Routes enforce `read:tasks` / `write:tasks`; `staffResourcePolicy.ts` owns the shared read boundary and `taskPolicy.ts` owns task writes.

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

- Use [`../docs/local/development.md`](../docs/local/development.md) for backend restarts, environment changes, migrations, database types, logs, debugging, and resets.
- Use [`../docs/testing.md`](../docs/testing.md) for full, backend-only, and focused test commands.
- Use [`../docs/deployment.md`](../docs/deployment.md) for CI, production deployment, monitoring, and production troubleshooting.
