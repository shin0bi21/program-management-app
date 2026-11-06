# Workflows

Follow the change through implementation, review, and merge to `develop`.
Production release is a separate, explicitly authorized workflow.

| Task | Guide |
|---|---|
| Trace local failures, inspect logs, or attach the debugger | [Debugging](../debugging.md) |
| Populate the local stack with production records | [Refresh Local Data](refresh-data.md) |
| Replace migration history with a current PostgreSQL init | [Collapse Database History](collapse-database.md) |
| Choose focused tests and understand suite ownership | [Testing](testing.md) |
| Write clear expressions, branching, names, and function phases | [Code Readability](../readability.md) |
| Document function contracts, examples, and non-obvious rules | [Code Documentation](../documentation.md) |
| Structure a runnable script and its helpers | [Script Structure](../scripts.md) |
| Map, review, ship, and clean up changes | [Phase order](../../../AGENTS.md#canonical-documentation); [Map](../../../.agents/skills/01-map-changes/SKILL.md), [Review](../../../.agents/skills/02-review-changes/SKILL.md), [Ship](../../../.agents/skills/03-update-repo/SKILL.md), [Complete](../../../.agents/skills/04-complete-changes/SKILL.md) |
| Release `develop` to `main`, verify deployment, or investigate a failed release | [Deploy to Production](../../production/deployment.md) |
| Understand required checks, diagnose CI, or change automation | [Continuous Integration](ci.md) |
| Measure CI, deployment history, or repository size | [Repository Reports](reports.md) |

For environment preparation, use [Setup Guide](../../local-development/01-tools.md).
For credential or service failures, use the [production runbooks](../../production/README.md).
