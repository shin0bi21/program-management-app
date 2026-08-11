# Time Entries

This shared feature owns the time-entry transport contract, reusable entry modal, category options, and cross-page types used by Timesheets and Tasks.

General time requires a cycle and category with an optional program. Task time sends an assigned task ID and the backend derives its category, cycle, and optional program. A contextual task workflow passes `initialTask`; the modal then locks both the task and its assigned staff while leaving date, hours, and note editable.

Pages own when the workflow opens and how successful writes refresh their page data. They must consume this shared modal rather than importing another page's private implementation or recreating the form.

Timesheet resource responses expose an authoritative `writable` capability. Staff can read the complete time-entry rows of coworkers who share any program assignment with them, including general and administrative time, but may mutate only their own resource. Page consumers must use `writable` consistently for cell actions, item mechanics, menus, and modal resource choices rather than reconstructing authorization from roles or entry metadata.
