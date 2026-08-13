# Time Entries

This shared feature owns the time-entry transport contract, reusable entry modal, category options, and cross-page types used by Timesheets and Tasks.

Pages own when the workflow opens and how successful writes refresh their page data. They must consume this shared modal rather than importing another page's private implementation or recreating the form.

The canonical entry, cycle, authorization, resource, and task-integration contract is [Time entries and timesheets](../../../../../docs/features/staff/timesheets.md). Keep this README limited to local module ownership and usage constraints.
