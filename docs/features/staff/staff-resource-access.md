# Staff-resource access

This shared feature contract governs which staff resources Tasks and Timesheets expose. [Assigned tasks](tasks.md) describe planned work; [time entries](timesheets.md) describe actual work.

Routes first require the applicable `read:*` or `write:*` permission. Policies then determine record scope.

- Administrators may read and mutate every active staff resource.
- Staff may read their own resource and the resources of coworkers who share any program assignment with them.
- Once a coworker resource is visible, its complete task or time-entry row is readable, including programless, general, and administrative records. Visibility is not re-filtered by the program relationship that exposed the resource.
- Staff mutations remain self-scoped. Readable coworker resources are not writable.
- API resources expose an authoritative `writable` capability when the frontend needs resource-specific actions. Consumers must not reconstruct this capability from roles, response order, or record metadata.

`backend/src/policies/staffResourcePolicy.ts` owns shared resource discovery. Domain policies apply task- and time-entry-specific writes. The complete authorization model is documented in [Authorization and record scope](../../development/backend/authorization-and-scope.md).

## Feature relationships

- Tasks require one staff owner and represent planned work over a date range.
- Time entries require a work date and recorded hours and represent actual work.
- General time owns its category and optional program directly.
- Task-linked time derives category, optional program, and staff scope from the authoritative task.
- Task-linked time preserves the referenced task for reporting, so a task with logged time cannot be deleted.
