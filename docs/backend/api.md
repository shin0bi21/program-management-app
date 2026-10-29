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
| Shared lookups `/reference-data` | [referenceDataRoutes](../../backend/src/routes/referenceDataRoutes.ts) | [referenceDataSchemas](../../backend/src/validation/referenceDataSchemas.ts) | [Reference data](reference-data.md) |
| Logged hours `/hours` | [hoursRoutes](../../backend/src/routes/hoursRoutes.ts) | [hoursSchemas](../../backend/src/validation/hoursSchemas.ts) | [Hours](../../backend/src/services/staff/hours/) |
| Assigned tasks `/tasks` | [taskRoutes](../../backend/src/routes/taskRoutes.ts) | [taskSchemas](../../backend/src/validation/taskSchemas.ts) | [Tasks](../../backend/src/services/staff/tasks/) |
| Youth profiles `/youth` | [youthRoutes](../../backend/src/routes/youthRoutes.ts) | [youthSchemas](../../backend/src/validation/youthSchemas.ts) | [Youth](../../backend/src/services/youth/) |
| Programs `/programs` | [programRoutes](../../backend/src/routes/programRoutes.ts) | [programSchemas](../../backend/src/validation/programSchemas.ts) | [Program service](../../backend/src/services/programService.ts) |
| Cycles `/cohorts/cycles` | [cycleRoutes](../../backend/src/routes/cycleRoutes.ts) | [cohortSchemas](../../backend/src/validation/cohortSchemas.ts) | [Cycle service](../../backend/src/services/programming/cycles/programCycleService.ts) |
| Cohorts and rosters `/cohorts` | [cohortRoutes](../../backend/src/routes/cohortRoutes.ts) | [cohortSchemas](../../backend/src/validation/cohortSchemas.ts) | [Cohorts](../../backend/src/services/programming/cohorts/) |
| Sessions and attendance `/cohorts` | [sessionRoutes](../../backend/src/routes/sessionRoutes.ts) | [cohortSchemas](../../backend/src/validation/cohortSchemas.ts) | [Sessions](../../backend/src/services/programming/sessions/) |
| Enrollment `/cohorts` | [enrollmentRoutes](../../backend/src/routes/enrollmentRoutes.ts) | [cohortSchemas](../../backend/src/validation/cohortSchemas.ts) | [Enrollment service](../../backend/src/services/programming/cohorts/enrollmentService.ts) |
| Schools `/schools` | [schoolRoutes](../../backend/src/routes/schoolRoutes.ts) | [schoolSchemas](../../backend/src/validation/schoolSchemas.ts) | [Youth school service](../../backend/src/services/youth/youthSchoolService.ts) |
| Leads `/leads` | [leadRoutes](../../backend/src/routes/leadRoutes.ts) | [leadSchemas](../../backend/src/validation/leadSchemas.ts) | [Leads](../../backend/src/services/outreach/leads/) |
| Homepage `/homepage`, public content and intake `/public` | [Homepage and public routers](../../backend/src/routes/homepageRoutes.ts) | [homepageSchemas](../../backend/src/validation/homepageSchemas.ts), [publicSchemas](../../backend/src/validation/publicSchemas.ts) | [Homepage service](../../backend/src/services/homepageService.ts) |
| Saved preferences `/preferences` | [preferenceRoutes](../../backend/src/routes/preferenceRoutes.ts) | [preferenceSchemas](../../backend/src/validation/preferenceSchemas.ts) | [Preference service](../../backend/src/services/preferenceService.ts) |

Uploads follow the shared [multipart transport contract](middleware.md#request-ordering).
Domain services own allowed file types. All APIs use the normal
[error response](errors.md#response-contract) and [authorization](authorization.md)
boundaries unless an endpoint explicitly defines a different response, such as a file.

## Hours and Tasks

Task-linked hours create/update responses include `updatedTask` when the actor has
`read:tasks`. The canonical projection is read inside the hours transaction after
its writes, so the caller can reconcile totals and any completion without a second
request. See [setHours](../../backend/src/services/staff/hours/hoursService.ts) and
[Hours integration tests](../../backend/tests/hours/hours.test.ts).

Table and calendar filters must agree without widening policy scope. Hours use
inclusive work dates; Tasks use overlap of their inclusive start/due interval.
Date filters apply before pagination, paired bounds are required, and multi-year
ranges are supported. Hours collection `cycleIds` match selected membership;
an empty selection is unrestricted, while its dashboard uses a single `cycleId`.
The [Hours](../../backend/tests/hours/hours.test.ts) and
[Tasks](../../backend/tests/tasks/tasks.test.ts) suites own the boundary cases.

## Youth Profiles and Lead Signup

[Shared DOB validation](../../backend/src/validation/dateOfBirth.ts) requires a
real date before today's Toronto date without an intake age restriction. Public
and internal Lead intake and the Youth UI require DOB. The Youth API temporarily
allows unknown DOB: omission preserves an existing value, explicit null clears
it, and creation without a value stores null. Youth responses expose DOB rather
than age or grade. Age eligibility belongs to program enrollment, so an existing
profile remains editable as a person ages.

Lead signup copies the stored or corrected DOB into the Youth profile and saves
any correction on the Lead in one audited transaction. A legacy Lead with unknown
DOB must supply it. Signup controls the `signed_up` status; follow-up notes and
other allowed status changes are independent. The [Lead service](../../backend/src/services/outreach/leads/leadService.ts),
[Lead tests](../../backend/tests/leads/), and [Youth write tests](../../backend/tests/youth/youthWrites.test.ts)
own these contracts. Preserve [historical audit interpretation](database.md#historical-snapshots)
when changing retired fields.

The focused contacts endpoint preserves unrelated profile data, including a
legacy null DOB, and returns the authoritative profile. Primary contacts also
serve as emergency contacts; relationship types belong to the
[Youth schema](../../backend/src/validation/youthSchemas.ts). Submitted contact
IDs must belong to active contacts on that profile; duplicates or unavailable IDs
reject the entire save. See [focused profile writes](../../backend/src/services/youth/youthService.ts)
and [focused write tests](../../backend/tests/youth/youthWrites.test.ts).

Program and cycle filters must match the same nonwithdrawn enrollment or
open-attendance participation. The [Youth filter owner](../../backend/src/services/youth/youthFilters.ts)
and [Youth list tests](../../backend/tests/youth/youth.test.ts) preserve that
cross-domain selection contract.

## Programming

### Program-Cycle Assignments

Programs and cycles share cohort relationships. Assignment edits replace the
checked set atomically while preserving retained cohort IDs. Removing a
relationship with sessions, enrollment history (including withdrawals), or
logged hours rejects the entire request. Deleting a referenced cycle also fails.
Program defaults affect future session creation, not existing timestamps.

[Assignment service](../../backend/src/services/programming/cohorts/assignmentService.ts)
and [cycle service](../../backend/src/services/programming/cycles/programCycleService.ts)
own the shared lock order: programs, cycles, then cohort relationships. Cycle
editing locks current programs in ID order before its cycle. Child foreign keys
coordinate dependent inserts with removal. Keep this ordering aligned with
session scheduling; [assignment tests](../../backend/tests/programs/assignments.test.ts)
cover atomic replacement and concurrency.

### Session Creation and Ranges

A program's `enrollmentRequired` flag controls enrollment versus open attendance;
it does not grant staff program access. Sessions use program scheduling defaults
and the program timezone (`America/Toronto`). Missing dates resolve the next
default weekday, including today only before the default start time. Supplied
dates remain unchanged. Local times are stored and returned as UTC instants;
skipped or repeated daylight-saving times are rejected.

Program-based creation resolves exactly one assigned cycle/cohort from the local
date inside the assignment-locking transaction. The UI supplies the program,
not a guessed cohort ID. Missing or overlapping matches conflict. Cohort-based
creation validates the date against that cohort's cycle. See
[session service](../../backend/src/services/programming/sessions/sessionService.ts)
and [session-default tests](../../backend/tests/cohorts/sessionDefaults.test.ts).

Session queries combine cycle, program, cohort, type, status, search, and date
filters while preserving program access. Paired timestamps use an exclusive end;
multi-year ranges and real calendar dates in years 0001–9999 are supported.
[Date-range tests](../../backend/tests/cohorts/dateRangeValidation.test.ts) and
[session list service](../../backend/src/services/programming/sessions/sessionListService.ts)
own range validation and filtering.

#### Move a Future Session Date

The focused date command preserves the program and local start/end times,
including overnight day spans. Both the source and destination must be future,
the source must not be cancelled, and exactly one assigned cycle must contain the
complete moved session. Recorded attendance, notes, attachments, or session-linked
hours prevent moving to another cycle. Ambiguous DST times conflict; unrelated
session fields remain unchanged. Its authoritative response supplies the new
placement for cache reconciliation. See the strict request in
[cohortSchemas](../../backend/src/validation/cohortSchemas.ts) and the
[session-move tests](../../backend/tests/cohorts/sessionMove.test.ts).

### Roster Eligibility

Roster lookup returns all eligible candidates independently of Youth table
pagination, plus existing enrollments even after aging out so they can be
withdrawn. Ages use today's Toronto date and inclusive program bounds; unknown
DOB is eligible only without age bounds. Open-attendance programs do not use this
roster. Enrollment writes recheck eligibility inside the transaction and reject
an invalid batch atomically. See [roster service](../../backend/src/services/programming/cohorts/cohortRosterService.ts),
[enrollment service](../../backend/src/services/programming/cohorts/enrollmentService.ts),
and [roster tests](../../backend/tests/cohorts/cohortRoster.test.ts).

## Outreach and Public Homepage

Public program content comes from program records and includes upcoming sessions,
even when a program's session list is empty. Signup availability is independent
of managed photos; disabling signup rejects new public intake with `409`.
The [homepage tests](../../backend/tests/homepage/homepage.test.ts) and
[public intake tests](../../backend/tests/public/public.test.ts) cover projections,
permissions, and the signup gate. Leads own follow-up and conversion.
