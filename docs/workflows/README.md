# Repository workflows

Choose the task you need to complete. These guides own executable procedures;
application contracts belong in [Frontend](../frontend/README.md) and
[Backend](../backend/README.md).

Use focused checks while implementing and required GitHub checks to merge into
`develop`. Review, shipping, and production deployment have separate handoff
boundaries; deployment always requires explicit authorization.

## Develop locally

| Task | Guide |
|---|---|
| Prepare a fresh checkout | [Set up the local environment](setup.md) |
| Restart services, update dependencies, or apply migrations | [Local development](local-development.md) |
| Trace a browser/API failure or attach a debugger | [Debugging](debugging.md) |
| Refresh or restore a local production-data copy | [Data snapshots](data-snapshots.md) |

## Verify and deliver

| Task | Guide |
|---|---|
| Choose tests and ownership boundaries | [Testing](testing.md) |
| Map, review, and ship approved concerns | [Review and merge changes](changes.md) |
| Understand required checks or diagnose CI | [Continuous integration](ci.md) |
| Measure CI or repository size | [Repository reports](reports.md) |

## Operate production

| Task | Guide |
|---|---|
| Release to production, verify, or investigate a failed deployment | [Deploy, verify, and recover](deployment.md) |
| Configure access or recover GitHub/SMTP credentials | [Production access](access.md) |

For editing and previewing this handbook, see [Documentation website](../README.md).
