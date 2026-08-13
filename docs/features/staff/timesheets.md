# Time entries and timesheets

- Scope: cross-stack and cross-page
- Primary route family: Staff
- Consumers: Timesheets and Tasks

A time entry records actual work for one staff resource on one date. The Timesheets page presents entries in list and calendar views and summarizes cycle-based information for the selected resource.

## Entry contract

- General time requires a work date and category and accepts an optional program.
- Task-linked time sends a work date and assigned task ID; the backend derives its category, optional program, and staff ownership from the authoritative task.
- Session-linked time sends an assigned session ID; the backend derives `program_delivery`, program, and work date from the authoritative non-cancelled session and verifies that the staff resource is assigned to its program.
- Every workflow requires positive hours and a non-empty note.
- Every create, update, or date-placement write derives exactly one organization cycle from the effective work date and rejects dates covered by zero or multiple eligible cycles.
- A contextual task workflow locks the task and assigned staff while leaving date, hours, and note editable.

## Task integration

- Creating or updating time linked to a `todo` task moves it to `in_progress` in the same transaction.
- Task time may be recorded outside the task's planned date range.
- Task linkage remains optional for general time.
- A referenced task cannot be deleted because time reporting retains the task identity and title.

See [Assigned tasks](tasks.md) for the authoritative task lifecycle and mutation rules.

## Authorization and resources

Routes enforce `read:timesheets` and `write:timesheets`. The shared [staff-resource access contract](staff-resource-access.md) determines readable resources. Staff writes remain self-scoped; administrators may write for every active staff resource. `timeEntryPolicy.ts` owns time-entry mutations.

Resource responses expose authoritative `writable`, `firstName`, `lastName`, and combined `name` fields. Consumers use `writable` consistently for calendar cells, item mechanics, menus, and modal resource choices.

## Dashboard periods

- The current pay period is the 14-day period containing today, anchored to the start of the most recently started organization cycle.
- That anchor continues through gaps until another cycle begins.
- The cycle selected in page filters controls the biweekly-average calculation only; it does not move the current pay period.
- Overlapping cycles with the same start date share the same pay-period anchor.

## Implementation ownership

- Backend policies: `backend/src/policies/staffResourcePolicy.ts` and `backend/src/policies/timeEntryPolicy.ts`
- Backend service and HTTP boundary: `backend/src/services/timeEntryService.ts`, time-entry validation, controller, and routes
- Backend tests: `backend/tests/timesheets/`
- Frontend route owner: `frontend/src/pages/Staff/Timesheets/`
- Shared frontend contract and modal: `frontend/src/common/features/timeEntries/`
- Task integration: `frontend/src/common/features/tasks/` and Tasks consumers

Route files and API tests remain authoritative for exact endpoint shapes. See the [backend API catalog](../../../backend/README.md#timesheets--time-entries).

## Changing this feature

- Add or change persistence: [Database changes](../../development/backend/database-changes.md)
- Add or change backend behavior: [Backend services](../../development/backend/services.md) and [policies](../../development/backend/policies.md)
- Add or change the Timesheets route page: [Adding a frontend page](../../development/frontend/adding-a-page.md)
- Change its list, calendar, or modal: [List view](../../development/frontend/list-view.md), [calendar view](../../development/frontend/calendar-view.md), or [forms and modals](../../development/frontend/forms-and-modals.md)
- Select verification: [Testing](../../operations/testing.md)
