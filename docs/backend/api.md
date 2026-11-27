# Backend API Overview

The application API is mounted under `/api` in
[index.ts](../../backend/src/index.ts). Use the source map below to find a
capability; route files own methods, paths, middleware, and permissions, while
validation schemas own accepted fields. This guide records cross-domain contracts
that a caller or maintainer must understand alongside those definitions.

## Find an API Owner

All mount paths below are relative to `/api`. Some routers share a mount while
owning separate capabilities.

| Area / mount | Routes | Validation | Service owner |
|---|---|---|---|
| Authentication `/auth` | [authRoutes](../../backend/src/routes/authRoutes.ts) | [authSchemas](../../backend/src/validation/authSchemas.ts) | [Auth](../../backend/src/services/auth/) |
| Accounts `/accounts` | [accountRoutes](../../backend/src/routes/accountRoutes.ts) | [accountSchemas](../../backend/src/validation/accountSchemas.ts) | [Accounts](../../backend/src/services/accounts/) |
| Shared lookups `/reference-data` | [referenceDataRoutes](../../backend/src/routes/referenceDataRoutes.ts) | [referenceDataSchemas](../../backend/src/validation/referenceDataSchemas.ts) | [Reference Data](reference-data.md) |
| Logged hours `/hours` | [hoursRoutes](../../backend/src/routes/hoursRoutes.ts) | [hoursSchemas](../../backend/src/validation/hoursSchemas.ts) | [Hours](../../backend/src/services/staff/hours/) |
| Assigned tasks `/tasks` | [taskRoutes](../../backend/src/routes/taskRoutes.ts) | [taskSchemas](../../backend/src/validation/taskSchemas.ts) | [Tasks](../../backend/src/services/staff/tasks/) |
| Youth profiles `/youth` | [youthRoutes](../../backend/src/routes/youthRoutes.ts) | [youthSchemas](../../backend/src/validation/youthSchemas.ts) | [Youth](../../backend/src/services/youth/) |
| Programs `/programs` | [programRoutes](../../backend/src/routes/programRoutes.ts) | [programSchemas](../../backend/src/validation/programSchemas.ts) | [Program service](../../backend/src/services/programService.ts) |
| Cycles `/cycles` | [cycleRoutes](../../backend/src/routes/cycleRoutes.ts) | [programmingSchemas](../../backend/src/validation/programmingSchemas.ts) | [Cycle service](../../backend/src/services/programming/cycles/cycleService.ts) |
| Program-cycle summaries and rosters `/programs` | [programRoutes](../../backend/src/routes/programRoutes.ts) | [programmingSchemas](../../backend/src/validation/programmingSchemas.ts) | [Program cycles](../../backend/src/services/programming/programCycles/) |
| Sessions and attendance `/sessions` | [sessionRoutes](../../backend/src/routes/sessionRoutes.ts) | [programmingSchemas](../../backend/src/validation/programmingSchemas.ts) | [Sessions](../../backend/src/services/programming/sessions/) |
| Enrollment `/programs/:programId/cycles/:cycleId` | [programRoutes](../../backend/src/routes/programRoutes.ts) | [programmingSchemas](../../backend/src/validation/programmingSchemas.ts) | [Enrollment service](../../backend/src/services/programming/programCycles/enrollmentService.ts) |
| Schools `/schools` | [schoolRoutes](../../backend/src/routes/schoolRoutes.ts) | [schoolSchemas](../../backend/src/validation/schoolSchemas.ts) | [Youth school service](../../backend/src/services/youth/youthSchoolService.ts) |
| Leads `/leads` | [leadRoutes](../../backend/src/routes/leadRoutes.ts) | [leadSchemas](../../backend/src/validation/leadSchemas.ts) | [Leads](../../backend/src/services/outreach/leads/) |
| Homepage `/homepage`, public content and intake `/public` | [Homepage and public routers](../../backend/src/routes/homepageRoutes.ts) | [homepageSchemas](../../backend/src/validation/homepageSchemas.ts), [publicSchemas](../../backend/src/validation/publicSchemas.ts) | [Homepage service](../../backend/src/services/homepageService.ts) |
| Saved preferences `/preferences` | [preferenceRoutes](../../backend/src/routes/preferenceRoutes.ts) | [preferenceSchemas](../../backend/src/validation/preferenceSchemas.ts) | [Preference service](../../backend/src/services/preferenceService.ts) |

Uploads follow the shared [multipart transport contract](middleware.md#request-ordering).
Domain services own allowed file types. All APIs use the normal
[error response](errors.md#response-contract) and [authorization](authorization.md)
boundaries unless an endpoint explicitly defines a different response, such as a file.

## Hours and Tasks

Tasks store `open`, `completed`, or `cancelled` in `tasks.state`, exposed as
`state` throughout task records. Staff fields match Hours: `staffId`, `firstName`,
`lastName`, and `name`. Open tasks expose
the date-derived status `upcoming`, `in_progress` (label “In Progress”), or
`overdue`; list and calendar filters use those derived values. Saved task filters
belong to the `task-preferences` key.

Send `POST /api/hours` to create an entry. Send `PATCH /api/hours/:id` with the
fields to change, including a date-only payload for a calendar move. Omitted
fields retain their saved values. A missing edit target returns 404.

Task-linked hours mutations include `updatedTasks` when the user has
`read:tasks`. This includes old and new tasks when an entry is reassigned. Hours
table, calendar, and save responses share one complete entry
shape; deletion returns the affected task rows. Calendar grouping belongs to the
frontend. Projections are read inside the write transaction,
so callers reconcile totals and completion without a second list request. See [setHours](../../backend/src/services/staff/hours/hoursService.ts).

Table and calendar filters must agree without widening policy scope. Hours use
inclusive dates stored in `time_entries.date`. Hours write commands, session
options, and returned entries use the same `date` field; session-linked creation
derives it from the session. Tasks use overlap of their inclusive start/due interval.
Date filters apply before pagination, paired bounds are required, and multi-year
ranges are supported. Hours collection `cycleIds` match selected membership;
an empty selection is unrestricted. Dashboard cards query independently:
`/hours/pay-period` accepts `staffId` and an optional `date` (the database's current date by
default), using the most recent cycle start on or before that date to anchor the
14-day pay period. It totals all entries within that period regardless of cycle
membership. `/hours/cycle-summary` accepts `staffId` and `cycleId` and returns the
cycle's category totals averaged over its elapsed biweekly periods. The cycle
selection does not restrict or move the pay-period query.

## Youth Profiles and Lead Signup

The staff Lead save uses an upsert: `POST /leads` generates a new ID, while
`PUT /leads/:id` creates at an unknown ID or replaces editable intake fields at
an existing ID. Both require the complete validated intake form. Existing origin,
submitter, creation metadata, status, and conversion fields are preserved.
Signed-up intake remains editable; those edits are audited and do not change the
linked Youth profile. Signup remains one-time, and converted leads retain their
status and deletion protections. Status, signup, note, and delete commands still
require an existing target.

[Shared DOB validation](../../backend/src/validation/dateOfBirth.ts) requires a
real date before the server's local current date without an intake age restriction. Public
and internal Lead intake require DOB. The Youth UI and API temporarily
allow unknown DOB: omission preserves an existing value, explicit null clears
it, and creation without a value stores null. The Youth form submits a blank DOB
as null. Youth responses expose DOB rather
than age or grade. Age eligibility belongs to program enrollment, so an existing
profile remains editable as a person ages.

Lead signup copies the stored or corrected DOB into the Youth profile and saves
any correction on the Lead in one audited transaction. A legacy Lead with unknown
DOB must supply it. Signup controls the `signed_up` status; follow-up notes and
other allowed status changes are independent. The [Lead service](../../backend/src/services/outreach/leads/leadService.ts)
owns signup.

The focused contacts endpoint preserves unrelated profile data, including a
legacy null DOB, and returns the authoritative profile. Primary contacts also
serve as emergency contacts; relationship types belong to the
[Youth schema](../../backend/src/validation/youthSchemas.ts). Submitted contact
IDs must belong to active contacts on that profile; duplicates or unavailable IDs
reject the entire save. See [focused profile writes](../../backend/src/services/youth/youthService.ts)
for the implementation.

Program and cycle filters must match the same nonwithdrawn enrollment or
open-attendance participation. The [Youth filter owner](../../backend/src/services/youth/youthRowFilters.ts)
preserves that cross-domain selection contract. School selections match any supplied
`schoolIds` and combine with search, Program, and Cycle before pagination. Omitting
school selections leaves profiles unrestricted by school, including those without one.

The main Youth record includes profile fields and one active program, or null when none is active.
The attendance dashboard reads attendance grouped by program/cycle from `/attendance`,
owned by the [attendance service](../../backend/src/services/attendanceService.ts).
Requested `youthIds` select one profile or a roster in a single request. Optional session,
program and cycle IDs restrict the records; callers supply the selected cycle ID
when they want current-cycle attendance. Historical attendance and recorded open-program visits remain available. Enrollment
or scheduled sessions without attendance records do not create attendance groups. Reads require Youth, attendance and session read permissions
and apply program scope. Attendance stays separate from profile rows.

Programs reads the same grouped attendance for its selected assignment. Dashboards pass
loaded groups directly to editors and reports. Attendance saves return the same attendance
contract alongside affected records. The PDF POST renders a supplied group without another
attendance query.

Counts and rates use completed, noncancelled sessions. Present and late count as attended;
absent and excused count as missed. Missing records remain unmarked in the frontend
and do not contribute to counts or rates. Each group includes its average for the returned participants.

## Programming

The Programs page owns program and cycle management; Sessions owns scheduling and
attendance. These pages use the programming APIs independently of Settings. Staff
retain assigned-program roster/session access. Project managers have all-program
scope and staff permissions plus `write:programs`; administrators retain their broader
account and staff-resource authority. Every endpoint still checks its own capability.
Program/cycle options used elsewhere remain shared reference data.

### Program-Cycle Assignments

Allowed program × cycle combinations are stored in `program_cycle_assignments`
with the composite primary key `(program_id, cycle_id)` and no surrogate ID.
Sessions and enrollments reference this pair directly; hours already stores it.
Attendance, notes, and attachments remain session-owned. Assignment edits replace
the checked set atomically while preserving retained pairs and all linked history. Removing a
relationship with sessions, enrollment history (including withdrawals), or
logged hours rejects the entire request. Deleting a referenced cycle also fails.
Program defaults affect future session creation, not existing session dates or times.

[Assignment service](../../backend/src/services/programming/programCycles/assignmentService.ts)
and [cycle service](../../backend/src/services/programming/cycles/cycleService.ts)
own the shared lock order: programs, cycles, then program-cycle relationships. Cycle
editing locks current programs in ID order before its cycle. Child foreign keys
coordinate dependent inserts with removal. Youth attendance writers also acquire the program-assignment lock before program-cycle
and session rows, serializing them with session moves. Keep this ordering aligned with
session scheduling.

### Session Creation and Ranges

A program's `enrollmentRequired` flag controls enrollment versus open attendance;
it does not grant staff program access. Sessions use program scheduling defaults
and the current date/time. Missing dates resolve the next
default weekday, including today only before the default start time. Supplied
dates remain unchanged. Sessions store `date` as `DATE` and `start_time` /
`end_time` as `TIME WITHOUT TIME ZONE`. Requests and rows use `date`
(`YYYY-MM-DD`), `startTime`, and `endTime` (`HH:mm` clock strings). End time must follow start time on the same
date; overnight sessions are unsupported. Supplied dates and clock values are
authoritative, including clock values on daylight-saving transition dates;
saves do not reconstruct timestamps or reject DST gaps/folds. The current clock is
used only for today/now rules; stored values are not converted for display.

Send `POST /api/sessions` to save a session. Creation takes `programId` and
session details. The service resolves exactly one assigned cycle covering the
date. Missing or overlapping matches return 409. Updates take the existing
session `id` and one or more editable fields; omitted fields keep their stored values, and
explicit `null` clears the optional description. A missing supplied ID returns
404 and never creates a replacement. The response is the same session record as
the session list. Creates and edits write `INSERT` and `UPDATE` audit events in
the session transaction. See the
[session service](../../backend/src/services/programming/sessions/sessionService.ts).

Session types are fixed enum values: `Regular`, `Guest Speaker`, and `Field Trip`.
Session requests and rows use `sessionType`; list filters use `sessionTypes`.

Session status and upcoming/completed membership depend on the saved date, not
clock times: dates before today's date are completed; today and later
are upcoming. Cancelled sessions retain their cancelled state. Attendance
completion, public upcoming sessions, and next-session summaries use this same
date boundary.

Session queries combine cycle, program, type, status, search, and date
filters while preserving program access. Paired date bounds are inclusive;
multi-year ranges and real calendar dates in years 0001–9999 are supported.
See the [session list service](../../backend/src/services/programming/sessions/sessionListService.ts).

#### Move a Future Session Date

Send the session `id` and new `date` to the same save endpoint to reschedule an
existing session. A date-only update preserves the program and other
saved fields, including both clock times. Both dates must be after today, the
source must be active, and exactly one assigned cycle must cover the destination.
Attendance, notes, attachments, or session-linked hours prevent a change of
cycle. A save that changes the session date updates and audits the work date on
linked Hours entries in the same transaction ID as the Session audit. Their
logged duration stays the same. Full edits remain within the session's current cycle.
A missing target returns 404 for users with global program access.

### Roster Eligibility

Roster lookup returns all eligible candidates independently of Youth table
pagination, plus existing enrollments even after aging out so they can be
withdrawn. Ages use the database's current date and inclusive program bounds; unknown
DOB is eligible only without age bounds. Open-attendance programs do not use this
roster. Enrollment writes recheck eligibility inside the transaction and reject
an invalid batch atomically. See [roster service](../../backend/src/services/programming/programCycles/programRosterService.ts) and
[enrollment service](../../backend/src/services/programming/programCycles/enrollmentService.ts).

Manage Roster submits the complete selected `youthIds` to
`PUT /programs/:programId/cycles/:cycleId/roster`, requiring `write:enrollments`.
The server diffs that selection against current membership inside one transaction.
It retains unchanged enrollment dates, enrolls additions, and marks removals as
withdrawn without deleting attendance. Invalid selections roll back the whole save.
See [roster mutation service](../../backend/src/services/programming/programCycles/programRosterMutationService.ts).

Youth can be enrolled in only one enrollment-based program on a calendar date.
Membership is the intersection of the cycle's inclusive dates and the enrollment
period: enrollment day is included and withdrawal day is excluded. Historical and
non-overlapping memberships remain valid; multiple cycles of the same program do
not count as different programs. Open-attendance participation does not count
as enrollment. Roster choices exclude conflicting programs while retained members
remain available for withdrawal. Enrollment, cycle-date, and program-mode writes
must preserve this rule; overlapping writes return a conflict.

## Outreach and Public Homepage

Public program content comes from program records and includes upcoming sessions,
even when a program's session list is empty. Public intake accepts valid lead
submissions with request validation and strict rate limiting. The signup form is
always available; it has no runtime availability setting.
Leads own follow-up and conversion.

Public and managed image lists share the canonical image projection. Image create
and update responses return that complete record, including variant URLs and
display order, so management can reconcile saved images directly. Frontend API
adapters share URL normalization for public lists, managed lists, and saved images.
