# Page Testing

## Test Page Coordination

Page tests cover the page's observable contract at its boundaries with data,
controls, views, and dialogs. A real hook or child may run inside the test, but its
internal policy still belongs in its own suite. Use the following reading order
for substantial page suites, omitting groups the page does not need:

| Group | Page-owned contract |
|---|---|
| Entry and readiness | Permission-dependent entry/actions, required data, and preference-restoration gates |
| Rendered states | Populated composition and page-owned empty or unavailable states |
| Controls and views | Applied search/filters reaching views, controlled settings, and view switching |
| Selection and coordination | Selected context shared across views and dashboards, saved-result coordination |
| Commands and dialogs | Entry targets, confirmed commands, and dialog success callbacks |

Keep failure cases beside the behavior they qualify, including readiness failures
and rejected commands. A test spanning several owners belongs to the group for
the page outcome it protects. The order describes how to read the suite, not the
order in which tests depend on each other or a mandatory test count.

For a table page, verify that its applied filter reaches the table and calendar
and that a selected record supplies the dashboard or dialog target. Delegate
domain table states and configuration to the [table owner](../components/tables.md#test-the-table),
record actions to their [row/action owner](../components/table-rows.md#testing),
and query inputs and lifecycle to the [data owner](../architecture/state-and-data.md#test-state-and-data).
Shared table suites own keyboard navigation, width behavior, and rendering mechanics.
Do not repeat those matrices in every route test.
