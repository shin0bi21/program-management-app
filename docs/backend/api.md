# Backend API overview

The API serves the application under `/api`. It covers authentication, accounts,
youth profiles, programming, outreach, staff work, and application settings.

Single-file uploads use `multipart/form-data`, put the binary file in the `file` field, and accept files up to 15 MB. Each endpoint's service validates its supported file types and any accompanying multipart fields.

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

### Shared reference data — `/reference-data`

Shared cycle, program, staff, and school projections serve filters and selectors
under their consuming page's permissions. Staff references require a `feature`
scope; assigned program references preserve assignment policies. See
[Reference data](reference-data.md) for endpoint shapes, authorization, and cache
reconciliation. These lookups do not grant access to management endpoints.

### Hours — `/hours`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/calendar` | Get policy-scoped, searchable logged hours shaped for a calendar date range |
| `GET` | `/table` | Get cursor-paginated, policy-scoped logged hours shaped for the table |
| `GET` | `/reference-data` | List Hours categories and types |
| `GET` | `/dashboard` | Get cycle-based pay-period and biweekly data shaped for one staff dashboard |
| `GET` | `/sessions` | List assigned sessions available for time entry |
| `POST` | `/` | Create a time entry |
| `PUT` | `/:id` | Update a time entry |
| `PATCH` | `/:id/placement` | Move a time entry to another work date without replacing unrelated fields |
| `DELETE` | `/:id` | Delete a time entry |

Staff writes are self-scoped while reads include policy-visible coworker resources; administrators can manage entries for active staff and administrators.

Task-linked create/update responses include `updatedTask` when the actor has `read:tasks`.
This canonical task projection is read inside the hours transaction, including the new
hours totals and any completion, so consumers can reconcile the task without a second request.

`GET /hours/table` accepts optional paired `start` and `end` dates in `YYYY-MM-DD` format and includes work dates on both boundaries. Date filters apply before cursor pagination. Table and calendar accept the full selected cycle span, including multi-year ranges. Both endpoints accept comma-separated UUID `cycleIds`: selected cycles match by membership; an empty selection leaves membership unrestricted. The dashboard retains its separate single `cycleId` input.

Time-entry validation, policies, services, and `backend/tests/hours/` are authoritative for entry, cycle, task-integration, and resource-scope behavior.

### Assigned tasks — `/tasks`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | List open assigned tasks, optionally scoped to one staff member |
| `GET` | `/calendar` | List filtered tasks intersecting a calendar date range |
| `GET` | `/list` | List cursor-paginated, policy-scoped tasks |
| `GET` | `/reference-data` | List Task categories and statuses |
| `GET` | `/:id` | Read a policy-scoped task in any lifecycle state, including logged-hour totals and daily breakdown; requires `read:tasks` and conceals missing or out-of-scope records with `404` |
| `POST` | `/` | Create a task with one required policy-scoped `staffId` owner |
| `PUT` | `/:id` | Update policy-scoped task details, dates, and owner |
| `PATCH` | `/:id/placement` | Move or resize a task without replacing unrelated task fields |
| `PATCH` | `/:id/state` | Update an assigned task's lifecycle state |
| `DELETE` | `/:id` | Delete a policy-scoped task without logged time |

`GET /tasks/list` accepts optional paired `start` and `end` dates in `YYYY-MM-DD` format. A task matches when its start/due interval overlaps the inclusive range. Date filters apply before cursor pagination. Table and calendar accept the full selected cycle span, including multi-year ranges.

Task validation, policies, services, and `backend/tests/tasks/` are authoritative for lifecycle, assignment, placement, deletion, hours integration, and resource-scope behavior.

### Youth — `/youth`

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | List youth or retrieve one profile with `?id=<uuid>` |
| `POST` | `/` | Create or update a youth profile |
| `PUT` | `/:id/contacts` | Replace only primary contacts and return the current profile |
| `PATCH` | `/:id` | Change youth status |
| `POST` | `/:id/invite` | Invite a youth account |
| `GET` | `/:id/cohorts/:cohortId/attendance` | Read youth-centric cohort attendance |
| `PUT` | `/:id/cohorts/:cohortId/attendance` | Replace youth-centric cohort attendance |
| `GET/POST` | `/:id/notes` | List or create youth profile notes |
| `PUT/DELETE` | `/:id/notes/:noteId` | Update or delete a youth profile note |

Youth profiles expose `dateOfBirth` without an age field or age sort. The Youth
table displays Date of Birth and supports server-side `dateOfBirth` sorting; unknown
DOBs display as a dash. The Youth UI omits age and grade. School grade and the former grade-derived age group are no longer
stored or returned. Program eligibility still calculates age from DOB when needed.

Existing audit rows and transaction IDs remain unchanged: their JSON snapshots may
still contain historical Lead `age`, Youth `gradeLevel`, or `ageGroup` fields. New
profile snapshots use DOB without those retired fields. Derived age changes on a
birthday do not create audit events; historical age must be calculated using DOB
and the event date, not today's date. The DOB backfill and column-removal migrations
are tracked in `schema_migrations` without creating per-record audit entries. Any
future undo/replay must map legacy snapshots to the current schema rather than
writing retired fields back to live tables.

The frontend Youth profile form requires a real DOB before today's Toronto date,
without an age restriction. The backend API temporarily accepts an
omitted or null `dateOfBirth`; supplied dates must still be real past dates. On
creation, omission stores null; on an existing profile, omission preserves the
saved DOB and explicit null clears it. Profiles remain valid and editable as people
age, including historical profiles. Age eligibility is checked when assigning a
program/cohort and is never a permanent database age constraint. Database DOB remains nullable until the
remaining unknown dates are backfilled and a separate constraint change is approved.
`PUT /youth/:id/contacts` requires `write:youth_profiles` and accepts only
`{ contacts: [...] }`; it preserves all profile fields, including a legacy null
DOB, and returns the authoritative profile after saving. A primary contact is also
the emergency contact; `type` describes the relationship and accepts only `parent`,
`sibling`, or `guardian`. Existing contact IDs must
belong to this profile’s active contacts. Foreign, inactive, or missing IDs return
`404`; duplicate IDs return `400`. Rejected requests preserve profiles, contacts,
relationships, and audit records.

`GET /youth` accepts comma-separated program and cycle UUIDs alongside search
and cursor filters. Program and cycle selections must match the same
nonwithdrawn enrollment or open-roster attendance.

### Programming

| Base path | Purpose |
|---|---|
| `/programs` | Full program records and management |
| `/cohorts` | Cohorts, enrollments, sessions, attendance, reports, notes, and attachments |
| `/cohorts/cycles` | Program-cycle management |
| `/schools` | School management |

| Method | Path | Purpose | Required permission |
|---|---|---|---|
| `GET` | `/cohorts/sessions/reference-data` | Assigned scheduling programs and session types | `read:sessions` |
| `GET` | `/cohorts/cycles` | List program cycles for management | `read:programs` |
| `POST` | `/cohorts/cycles` | Create a program cycle | `write:programs` |
| `PUT` | `/cohorts/cycles/:cycleId` | Update a program cycle | `write:programs` |
| `DELETE` | `/cohorts/cycles/:cycleId` | Delete an unused program cycle | `write:programs` |

Cycles are shared across cohorts and staff hours. Their service owner is
[`programCycleService.ts`](../../backend/src/services/programming/cycles/programCycleService.ts);
HTTP routing and validation remain in `cohortRoutes.ts` and `cohortSchemas.ts`.
Deleting a cycle referenced by a cohort or time entry returns `409`.

`GET /cohorts/sessions` accepts comma-separated UUID `cycleIds` to filter sessions across
the selected cycles' cohorts. It combines with program, cohort, session-type, status,
search, date-range and pagination filters while preserving program access restrictions.
Paired session timestamps use an exclusive end. Multi-year ranges are accepted;
calendar dates use the program timezone and calendar arithmetic across daylight-saving
changes.
Date-range query validation accepts real calendar dates in years 0001–9999, without
restricting bounds to existing cycles.

Program create/update and lookup records include `defaultDayOfWeek` (lowercase weekday),
`defaultStartTime` and `defaultEndTime` (`HH:mm`), and `timezone` (`America/Toronto`, the only supported program timezone).
`enrollmentRequired` is a boolean (default `true`): `true` requires youth enrollment;
`false` allows open attendance. Cohort, session, Youth participation, and public program
records expose the same flag. Program writes reject the removed `rosterMode` field.
Existing programs begin with Tuesday, 17:00–19:30, America/Toronto. Defaults only
apply when creating future sessions; changing them does not rewrite saved timestamps.

`POST /cohorts/sessions` requires `write:sessions` and access to the supplied `programId`.
It accepts `programId`, `sessionTypeId`, and `theme`, plus optional `date`, `startTime`,
`endTime`, and `description`. Missing scheduling fields use the program defaults described
below. The effective local date resolves exactly one assigned cycle/cohort for the program.
No matching cycle returns `409` with a settings action; overlapping assigned cycles return
`409` instead of silently choosing a cohort. Program, cycle, and cohort reads and insertion
share the assignment-locking transaction. The UI does not supply a cohort ID.

`POST /cohorts/:cohortId/sessions` requires `write:sessions` and access to the cohort.
The body requires `sessionTypeId` and `theme`, with optional `date` (`YYYY-MM-DD`),
`startTime`, `endTime`, and nullable `description`. Missing times use program defaults.
A missing date uses the next default weekday in the program timezone, including today
only before the default start time. A supplied date is preserved. The date must fall
within the cohort's cycle, and end time must follow start time. Local program times
are converted to timezone-aware timestamps; API timestamps serialize in UTC. Skipped
or repeated wall-clock times at daylight-saving transitions return `409`, requiring
an unambiguous local time.

#### Move a future session date

`PUT /api/cohorts/sessions/:sessionId/date` requires `write:sessions` and access
to the session's program. The strict request body is `{ "date": "YYYY-MM-DD" }`.
Only future, non-cancelled sessions may move, and the destination start must be
future. The command preserves the program and local start/end wall-clock times,
including an overnight local day span, then stores the resulting UTC instants.
Skipped or repeated DST times are rejected. Exactly one assigned cycle must
contain the complete moved session. A move to another cycle is rejected when
attendance, notes, attachments, or session-linked hours exist. Other session
fields remain unchanged.

The response contains `id`, `cohortId`, `cohortName`, `cycleId`, `startsAt`, and
`endsAt`. Invalid dates return 400; lifecycle, destination, or recorded-data
conflicts return 409.

### Outreach

| Base path | Purpose |
|---|---|
| `/public` | Unauthenticated homepage content and public lead intake |
| `/expressions-of-interest` | Internal review, status updates, and lead conversion |
| `/leads` | Lead intake, status management, follow-up notes, and youth signup |

`GET /public/homepage/programs` returns every program ordered by minimum age,
with null age ranges first, and nests its next three non-cancelled sessions.
Programs remain present when they have no upcoming sessions; names, descriptions,
age ranges, and enrollment requirement come directly from the program record.

`GET /public/homepage/images` returns the managed images. Signup availability is
loaded independently through `GET /public/homepage/signup`, which returns the
`signupEnabled` flag. `GET /homepage/signup` exposes that setting to users with
`read:homepage` permission. `POST /public/leads` returns `409` while
homepage signup is disabled.

`PATCH /homepage/signup` enables or disables public homepage signup for users
with `write:homepage` permission.

Lead workflow endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/leads` | List Leads or create an internal Lead |
| `PUT/DELETE` | `/leads/:id` | Update or delete an unsigned Lead |
| `PATCH` | `/leads/:id/status` | Directly update an unsigned Lead's status |
| `GET/POST` | `/leads/:id/notes` | List or add `follow_up` notes independently of Lead status |
| `PUT/DELETE` | `/leads/:id/notes/:noteId` | Edit or delete a follow-up note |
| `POST` | `/leads/:id/sign-up` | Create the youth profile and set the system-owned `signed_up` status |

Lead intake stores `dateOfBirth` instead of an entered age. Public and internal
create/update requests require a real birth date before today's Toronto date, with no
intake age restriction;
the removed `age` request field is rejected. Responses include nullable `dateOfBirth` and
nullable derived `age`; existing Leads keep unknown birth dates rather than guessing from
previous ages. A follow-up migration recovers missing DOBs from known linked Youth
profiles for signed-up Leads, preserving any DOB already stored on the Lead. Unresolved
DOBs remain null, without an age-based program recommendation until supplied.

Lead signup uses the stored birth date or the supplied `dateOfBirth`. A legacy Lead with
no birth date must provide one before profile creation. Signup copies the exact date into
the Youth profile and saves any correction on the Lead in the same audited transaction.
Profile creation has no age restriction; a selected cohort must still permit
enrollment and match its current program age bounds. Public intake, internal Leads,
and Youth profile requests reuse the shared DOB schema in `validation/dateOfBirth.ts`;
it validates the date itself, while assignment services own age eligibility.

Every Lead note has the `follow_up` category. Note details are editable and notes may be deleted independently of Lead status. Lead status is managed separately; staff may assign `new`, `contacted`, `eligible`, `ineligible`, `deferred`, or `closed`, while `signed_up` remains system-controlled.

For lifecycle, ownership, and implementation, see the [Backend guide](README.md) and the focused documents beside this file. Local commands, testing, and deployment are routed through the root application README.

Program-cycle assignment commands retain the existing cohort identity. `PUT
/programs/:programId/cycles` requires `write:programs`, accepts `{ cycleIds:
string[] }`, and returns `{ programId, cycleIds }` with cycle IDs sorted. It
replaces the complete checked set atomically and preserves retained cohort IDs.
Both `POST /cohorts/cycles` and `PUT /cohorts/cycles/:cycleId` accept cycle details
plus required unique `programIds: string[]`; an empty array intentionally selects
no programs. They save details and assignments in one transaction. Any removal
with sessions, enrollment history, or logged hours returns 409 without saving any
part of the request. Direct cohort deletion follows the same rule.

`GET /cohorts/:cohortId/roster` requires `read:programs` and `read:youth_profiles`,
plus access to the cohort's program. It returns the full roster candidate list independently
of Youth table pagination. Ages are calculated on the current Toronto date. New candidates
must meet the program's inclusive minimum/maximum ages; a missing birth date is eligible
only when the program has no age limits. Current enrollments remain visible even after
aging out, so staff can withdraw them. Open-attendance programs do not use this endpoint.

Roster additions require `write:enrollments` and validate current age limits and birth dates
inside the enrollment transaction. An ineligible member rejects the entire batch. The UI
requires enrollment-write and youth-read permissions for Manage Roster; assignment editing
continues to require `write:programs`. The roster's age limits are read-only and configured
on the program. These eligibility-specific ages remain separate from the Youth profile
response, which does not calculate or expose age.
