# Backend API reference

Paths are relative to `/api`. Protected endpoints require the permissions declared by the route and summarized in the [RBAC model](auth.md#3-rbac-model). Route files under [`backend/src/routes/`](../../backend/src/routes/) are authoritative for exact paths, validation middleware, and required permissions.

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

### Hours — `/hours`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | List hours resources and entries for a date range |
| `GET` | `/list` | List cursor-paginated, policy-scoped logged hours |
| `GET` | `/options` | List readable staff resources and programs |
| `GET` | `/overview` | Get cycle-based pay-period and biweekly dashboard data for one staff member |
| `GET` | `/sessions` | List assigned sessions available for time entry |
| `POST` | `/` | Create a time entry |
| `PUT` | `/:id` | Update a time entry |
| `PATCH` | `/:id/placement` | Move a time entry to another work date without replacing unrelated fields |
| `DELETE` | `/:id` | Delete a time entry |

Staff writes are self-scoped while reads include policy-visible coworker resources; administrators can manage entries for active staff and administrators.

Time-entry validation, policies, services, and `backend/tests/hours/` are authoritative for entry, cycle, task-integration, and resource-scope behavior.

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

Task validation, policies, services, and `backend/tests/tasks/` are authoritative for lifecycle, assignment, placement, deletion, hours integration, and resource-scope behavior.

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

For lifecycle, ownership, and implementation, see the [Backend guide](README.md) and the focused documents beside this file. Local commands, testing, and deployment are routed through the root application README.
