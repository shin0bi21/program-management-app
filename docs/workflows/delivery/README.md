# Workflows

Choose the guide for the requested task. Implementation, review, and shipping
have separate stopping points; production release requires explicit authorization.

| Task | Guide |
|---|---|
| Trace local failures, inspect logs, or attach the debugger | [Debugging](../debugging.md) |
| Populate the local stack with production records | [Refresh Local Data](refresh-data.md) |
| Replace migration history with a current PostgreSQL init | [Collapse Database History](collapse-database.md) |
| Choose focused tests and understand suite ownership | [Testing](testing.md) |
| Follow naming, typing, and source-comment conventions | [Coding Standards](../../coding-standards/README.md) |
| Structure a runnable script and its helpers | [Script Structure](../../coding-standards/scripts.md) |
| Map, review, ship, and clean up changes | [Phase order](../../../AGENTS.md#canonical-documentation); [Map](../../../.agents/skills/01-map-changes/SKILL.md), [Review](../../../.agents/skills/02-review-changes/SKILL.md), [Ship](../../../.agents/skills/03-update-repo/SKILL.md), [Complete](../../../.agents/skills/04-complete-changes/SKILL.md) |
| Release `develop` to `main`, verify deployment, or investigate a failed release | [Deploy to Production](../../production/deployment.md) |
| Understand required checks, diagnose CI, or change automation | [Continuous Integration](ci.md) |
| Inspect changes, CI history, or repository size | [Reports](#reports) |

For environment preparation, use [Setup Guide](../../local-development/01-tools.md).
For credential or service failures, use the [production runbooks](../../production/README.md).

## Reports

Run from the repository root. Append `-- --help` to a command for its options and examples.

| Task | Command and source |
|---|---|
| Inspect branch and working-tree changes and their selected checks | [npm run report:changes](../../../scripts/reports/file-changes-report.ts) |
| Compare completed CI checks and production deployments | [npm run report:ci-history](../../../scripts/reports/ci-history-report.ts) |
| Count repository lines by file type | [npm run report:loc](../../../scripts/reports/loc-report.ts) |
