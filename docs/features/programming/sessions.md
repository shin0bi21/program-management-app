# Sessions and attendance

Sessions own their schedule, notes, attachments, and roster-based attendance workflow.

## Attendance ownership

- `sessionAttendanceService.ts` reads and replaces attendance for many youth in one session.
- `youthAttendanceService.ts` reads and replaces attendance for one youth across a cohort's sessions.
- Both commands write `attendance_records`, but each service authorizes and replaces only its own scope.
- Cohorts supply program, cycle, and enrollment context. They do not own attendance commands.

Session notes remain owned by `programming/sessions/sessionNoteService.ts`, including the query that shows those notes on a Youth profile.

## Implementation

- Backend policy: `backend/src/policies/programAccessPolicy.ts`
- Backend services: `backend/src/services/programming/sessions/`
- Backend HTTP boundary: `backend/src/validation/cohortSchemas.ts`, `backend/src/controllers/cohortController.ts`, and `backend/src/routes/cohortRoutes.ts`
- Backend tests: `backend/tests/cohorts/`
- Frontend API: `frontend/src/common/features/programming/api/sessions.api.ts`
- Frontend route owner: `frontend/src/pages/Programming/Sessions/`
- Youth consumer: `frontend/src/pages/Youth/`

The Programming Sessions page owns roster attendance. Youth consumes the youth-scoped attendance and session-note views described in [Youth profiles and attendance](../youth/profiles.md).

## Changing this feature

- Change persistence: [Database changes](../../development/backend/database-changes.md)
- Change services or access: [Backend services](../../development/backend/services.md) and [policies](../../development/backend/policies.md)
- Change the Sessions page: [Adding a frontend page](../../development/frontend/adding-a-page.md)
- Change its list, calendar, attendance modal, notes, or attachments: [List view](../../development/frontend/list-view.md), [calendar view](../../development/frontend/calendar-view.md), or [forms and modals](../../development/frontend/forms-and-modals.md)
- Learn an API used by those owners: [Application stack](../../development/stack/README.md)
- Select verification: [Testing](../../operations/testing.md)
