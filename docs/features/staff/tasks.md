# Assigned tasks

- Scope: cross-stack and cross-page
- Primary route family: Staff
- Consumers: Tasks and Timesheets

An assigned task represents concrete planned work for exactly one staff owner. Unscheduled or unassigned program backlog work is a separate future domain and must not weaken the current task invariants.

## Data contract

- `category`, `startDate`, and `dueDate` are required.
- `programId` is optional.
- Every task has exactly one required `staffId` owner.
- Dates use `YYYY-MM-DD`, and `dueDate` must be on or after `startDate`.
- Planned dates may change after time is logged. Actual task time may fall before or after the planned range.
- Responses expose total `hoursLogged` and `loggedHoursByDate` for dashboard and calendar consumers.
- Staff option and assignee resources expose required `firstName`, `lastName`, and combined `name` fields.

## Lifecycle

- New tasks begin as `todo`.
- A to-do task may be cancelled before work begins.
- Creating or updating task-linked time moves a `todo` task to `in_progress` in the same transaction.
- An `in_progress` task with logged time may be completed. Any open `todo` or `in_progress` task may be cancelled.
- A completed task reopens as `in_progress`.
- A cancelled task reopens as `todo` when it has no logged time and as `in_progress` otherwise.
- Ordinary edits and calendar placement changes preserve status.
- Task-linked time may be created or edited only while the task is `todo` or `in_progress`.

## Assignment, placement, and deletion

- Only a `todo` task without logged time may be reassigned.
- Calendar movement and resizing use the narrow placement command. Its request owns only `startDate`, `dueDate`, and an optional replacement `staffId`.
- The backend locks and rereads the authoritative task before placement so cached frontend data cannot overwrite newer content or status.
- A task referenced by time entries cannot be deleted because its identity and title are required for reporting history.

## Authorization and visibility

Routes enforce `read:tasks` and `write:tasks`. The shared [staff-resource access contract](staff-resource-access.md) determines readable resources. Staff writes are self-scoped; administrators may mutate every active staff task resource. `taskPolicy.ts` owns task mutation rules.

## Presentation contract

- Compact calendar items show title and category.
- Shared hover details show program, planned dates, total logged hours, and task details.
- The task dashboard is resource-scoped rather than account- or calendar-filter-scoped. Selecting a readable staff resource shows that person's overview while actions remain capability-scoped.
- Active-task summaries include `todo` and `in_progress` tasks. A task is overdue only when active and its due date is before today.
- Contextual **Log Hours** workflows lock the selected task and assigned staff while date, hours, and note remain editable.

## Implementation ownership

- Backend policy: `backend/src/policies/taskPolicy.ts`
- Backend service and HTTP boundary: `backend/src/services/taskService.ts`, task validation, controller, and routes
- Backend tests: `backend/tests/tasks/`
- Frontend route owner: `frontend/src/pages/Staff/Tasks/`
- Shared frontend contract: `frontend/src/common/features/tasks/`
- Time-entry integration: `frontend/src/common/features/timeEntries/` and Timesheets consumers

Route files and API tests remain authoritative for exact endpoint shapes. See the [backend API catalog](../../../backend/README.md#assigned-tasks--tasks).

## Changing this feature

- Add or change persistence: [Database changes](../../development/backend/database-changes.md)
- Add or change backend behavior: [Backend services](../../development/backend/services.md) and [policies](../../development/backend/policies.md)
- Add or change the Tasks route page: [Adding a frontend page](../../development/frontend/adding-a-page.md)
- Change its list, calendar, or modal: [List view](../../development/frontend/list-view.md), [calendar view](../../development/frontend/calendar-view.md), or [forms and modals](../../development/frontend/forms-and-modals.md)
- Select verification: [Testing](../../operations/testing.md)

## Deferred product work

An administrator-only history view may eventually preserve and expose assignee, status, start-date, and due-date changes. It must be designed before imposing additional creation or date-change restrictions; it is not part of the current contract.
