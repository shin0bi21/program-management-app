# Workflows

Follow the change through implementation, review, and merge to `develop`.
Production release is a separate, explicitly authorized workflow.

| Task | Guide |
|---|---|
| Populate the local stack with production records | [Refresh Local Data](refresh-data.md) |
| Replace migration history with a current PostgreSQL init | [Collapse Database History](collapse-database.md) |
| Choose focused tests and understand suite ownership | [Testing](testing.md) |
| Review file responsibilities, reading order, and layer boundaries | [File Structure and Ownership](../file-structure.md) |
| Structure a runnable script and its helpers | [Script Structure](../scripts.md) |
| Map concerns, review changes, and ship approved work to `develop` | [Review and Merge Changes](review-and-merge.md) |
| Release `develop` to `main`, verify deployment, or investigate a failed release | [Deploy, Verify, and Recover](deployment.md) |
| Understand required checks, diagnose CI, or change automation | [Continuous Integration](ci.md) |
| Measure CI, deployment history, or repository size | [Repository Reports](reports.md) |

For environment preparation, use [Local Development](../local-development/tools.md).
For credential or service failures, use the [production runbooks](../production/README.md).
