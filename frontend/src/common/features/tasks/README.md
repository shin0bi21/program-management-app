# Tasks

This feature owns reusable task and staff-assignment contracts. Tasks classify concrete work and may be consumed by Timesheets or future task-list pages.

Task start and due dates are required planning metadata. Logged time may fall outside that range, and logging time does not lock later task-range movement or resizing. Assignment remains stricter: only to-do tasks without logged time may be reassigned.

Calendar movement and resizing use the narrow task-placement API. Placement writes accept only `startDate`, `dueDate`, and an optional replacement `staffId`; they must never resend a cached full task because that could overwrite newer content or status changes. The backend locks and reads the authoritative task before applying placement and auditing the result.

Task responses include `hoursLogged` plus `loggedHoursByDate`, which contains task-linked hours aggregated by calendar date. Dashboard consumers can build a daily breakdown without loading the full timesheet-entry dataset.

Task assignees and task-option resources expose required `firstName`, `lastName`, and combined `name` fields. List tables use the separate fields; calendars, selectors, cards, and compact labels use the server-provided combined name.

Compact task calendar items show title and category. Their shared hover-details panel also shows program, cycle, planned dates, total hours logged, and task details; hours do not appear in the compact item summary.

The task dashboard is resource-scoped, not account-scoped or calendar-filter-scoped. Selecting any readable staff resource shows that person's overview while write actions remain capability-scoped. The dashboard summarizes active assignments, tasks due in the current Monday-through-Sunday week, and overdue active tasks; its detail report names the tasks and due dates in the latter two groups. An active task is `todo` or `in_progress`; it is overdue only when its due date is before today. Calendar items expose overdue state through the shared trailing-content slot, while the task page owns the task-specific red indicator and report language.

Time entry creation has separate general and task contracts. General time supplies a required cycle and category plus an optional program. Task time supplies only an assigned task ID for its business scope; the backend derives its required cycle and category plus optional program from the task. Task dates describe the plan and do not restrict when actual time may be logged.

Task pages may open the shared time-entry modal contextually with `initialTask`. That workflow locks the task and its assigned staff, while date, hours, and note remain editable. Calendar-item activation and list-row selection must update the selected task before dashboard actions such as **Log Hours** run.

- A task has one required category, one required cycle, an optional program, and exactly one staff owner.
- Unscheduled or unassigned program backlog work is a separate future domain. It should convert into a fully scheduled, assigned task rather than weakening the current task invariants.
- Staff resource visibility is determined once at the resource boundary. Staff may read the complete task rows of coworkers who share any program assignment with them, including those coworkers' programless and administrative tasks; staff may still mutate only their own tasks. Administrators may read and mutate every task resource.
- Time entries may reference an assigned task, but task linkage remains optional.
- Assigning time to a to-do task starts it automatically. Once in progress, a task cannot be cancelled.
- Pages own task presentation and workflow composition; generic components and `ResourceCalendar` do not import this feature.

## Deferred work

- Add an administrator-only task history view before restricting task creation or date changes further. History must preserve assignee, status, start-date, and due-date changes and respect the user's date/time display preferences.
