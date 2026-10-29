# Deploy, Verify, and Recover

Deployment requires separate explicit authorization from feature shipping.
Release through a pull request from `develop` to `main`; merging it automatically
deploys production. See [access and credentials](../production/access.md) for initial setup or
authentication failures.

## Release to Production

1. Confirm the approved release scope is merged into `develop`, its checks have
   passed, and migration or operational prerequisites are understood. Resolve
   outstanding production-access failures before merging the release.
2. Open a release pull request from `develop` to `main`. Review its complete diff
   and wait for the [required checks](ci.md#required-checks), including production
   image and Compose validation.
3. Merge with a regular merge commit so `develop` remains in production history.
   Do not squash or rebase the release. Record the resulting `main` commit.
4. In **Actions → Deploy Production**, open the run for that commit. Wait for
   **Deploy via SSH** and **Verify public production routes** to succeed.
5. Check the changed user-facing behavior in production. Public `/health` and
   homepage responses are smoke checks; they do not prove that every feature,
   authenticated action, or external integration works.

```text
feature → PR to develop → required CI
develop → release PR to main → required CI + production validation
main push → SSH to Lightsail → scripts/deploy/main.sh → public smoke checks
```

<a id="ci-and-automatic-deployment"></a>
<a id="troubleshooting-checklist"></a>

## Monitoring and Rerunning a Deployment

Record the failed job/step and target commit before retrying. The workflow checks
required secret names before SSH, rejects an uncommitted server working tree,
fetches `origin/main`, synchronizes the checkout, and runs the deployment script.
It then requests the public health endpoint and homepage with bounded retries.

| Failure | Next action |
|---|---|
| Missing secret or SSH connection | Follow [deployment access](../production/access.md#deployment-access) |
| GitHub fetch rejected | Follow [server GitHub access](../production/github-authentication.md#server-github-access) |
| Dirty server checkout | Inspect and preserve the changes; resolve their ownership before retrying |
| Build, migration, or service replacement | Inspect the failed step and `logs/deploy.log` on Lightsail |
| Public health/homepage check | Follow [nginx and TLS diagnostics](../production/nginx-and-tls.md#identify-the-failing-boundary) |
| Login verification email | Follow [email recovery](../production/email-recovery.md#restore-verification-email) |

After correcting a configuration or transient failure for an authorized release,
use **Re-run jobs → Re-run failed jobs**. A new commit is not needed. Check whether
`main` has advanced first: the deployment fetches current `origin/main`, so rerunning
an older Actions run can deploy newer code. Confirm that target is authorized.

## Manual Access and Deployment

Administrators performing an authorized manual release or recovery should follow
[Manual Access and Deployment](../admin/manual-deployment.md).

## Recovery Boundaries

Stop on a failed deployment and inspect its last successful phase before changing
state again. Preserve the target commit, Actions output, and deployment log.

- A migration apply or post-apply validation failure triggers an attempted
  restore while the rollback guard is active. Pre-apply and status-only checks
  do not trigger database restoration. Inspect the cleanup output; an attempted
  restore is not proof that the database is healthy.
- That rollback guard ends after successful migration validation. A subsequent
  service replacement or public smoke-check failure does not automatically undo
  migrations or restore earlier application containers.
- The script removes its temporary snapshot during cleanup, including after a
  failed restore. Do not treat it as a retained disaster-recovery backup. A failed
  restore needs operator intervention and a separately verified recovery source.
- There is no generic previous-release rollback command in this workflow.
  Running `main.sh` after checking out an older commit fetches current
  `origin/main` again. Choose an explicitly authorized corrective release or an
  operator-led recovery compatible with the current database; do not guess a
  database downgrade or rewrite an applied migration.

## Deployment Selection and Docker Caching

The script compares the target commit with the last successful frontend, backend,
and infrastructure revisions in `.deploy-state/`:

| Change | Selected work |
|---|---|
| Frontend | Build and replace nginx/frontend |
| Backend | Build, validate migrations, replace backend, and check health |
| Migration files | Snapshot and apply migrations before backend replacement |
| Production infrastructure or shared TypeScript policy | Conservative full flow |
| Recognized documentation, local-test, data-refresh, or report tooling paths only | No production container rebuild |

Unknown paths (including scaffold and pattern tooling) and missing revision markers
select the full flow. Docker layer caching is separate:
a selected build can reuse unchanged layers. A full deployment is not a
`--no-cache` build; dependency installation occurs during image building, not
each container start.

The executable owners are [the deployment workflow](../../../.github/workflows/deploy.yml)
and [the script entry point](../../../scripts/deploy/main.sh), with numbered steps
beside it for synchronization, selection, migration safeguards, replacement, and
cleanup. [CI](ci.md) owns pull-request validation and required checks.
