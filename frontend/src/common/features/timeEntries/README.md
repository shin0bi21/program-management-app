# Time Entries

This shared feature owns the time-entry transport contract, reusable entry modal, category options, and cross-page types used by Timesheets and Tasks.

General time requires a category with an optional program. Task time sends an assigned task ID and the backend derives its category and optional program. The backend derives exactly one cycle from the effective work date. A contextual task workflow passes `initialTask`; the modal then locks both the task and its assigned staff while leaving date, hours, and note editable.

Pages own when the workflow opens and how successful writes refresh their page data. They must consume this shared modal rather than importing another page's private implementation or recreating the form.

The Timesheets dashboard has two distinct cycle contracts. The current pay period is the 14-day period containing today, counted from the start of the most recently started organization cycle; that anchor continues through gaps until the next cycle starts. The cycle selected in the page filters controls the biweekly-average calculation only, so selecting an upcoming or completed cycle does not move the current pay period. Overlapping cycles with the same start date share the same pay-period anchor.

Timesheet resource responses expose an authoritative `writable` capability. Staff can read the complete time-entry rows of coworkers who share any program assignment with them, including general and administrative time, but may mutate only their own resource. Page consumers must use `writable` consistently for cell actions, item mechanics, menus, and modal resource choices rather than reconstructing authorization from roles or entry metadata.

Each timesheet resource also exposes required `firstName`, `lastName`, and combined `name` fields. List columns use the separate fields; calendars, filters, selectors, dashboards, and modal titles use the server-provided combined name.
