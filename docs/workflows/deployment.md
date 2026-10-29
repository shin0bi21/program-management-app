# Deploy, verify, and recover

Deployment requires separate explicit authorization from feature shipping.
Release through a pull request from `develop` to `main`; merging it automatically
deploys production. See [access and credentials](access.md) for initial setup or
authentication failures.

## Release to production

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

## Monitoring and rerunning a deployment

Record the failed job/step and target commit before retrying. The workflow checks
required secret names before SSH, rejects an uncommitted server working tree,
fetches `origin/main`, synchronizes the checkout, and runs the deployment script.
It then requests the public health endpoint and homepage with bounded retries.

| Failure | Next action |
|---|---|
| Missing secret or SSH connection | Follow [deployment access](access.md#deployment-access) |
| GitHub fetch rejected | Follow [server GitHub access](access.md#server-github-access) |
| Dirty server checkout | Inspect and preserve the changes; resolve their ownership before retrying |
| Build, migration, or service replacement | Inspect the failed step and `logs/deploy.log` on Lightsail |
| Public health/homepage check | Inspect production container status and logs, then verify HTTPS reachability |
| Login verification email | Follow [email recovery](access.md#restore-verification-email) |

After correcting a configuration or transient failure for an authorized release,
use **Re-run jobs → Re-run failed jobs**. A new commit is not needed. Check whether
`main` has advanced first: the deployment fetches current `origin/main`, so rerunning
an older Actions run can deploy newer code. Confirm that target is authorized.

## Manual access and deployment

Use manual deployment only for an authorized release or recovery. Connect from
the workstation holding the authorized key:

```bash
ssh -i ~/.ssh/be-original-key.pem ubuntu@18.216.104.46
```

On Lightsail, enter the production checkout and inspect it:

```bash
cd /home/ubuntu/my-webapp
git status --short
./scripts/deploy/main.sh --plan
```

The plan skips image builds, containers, database changes, and revision-marker
writes. It still acquires the deployment lock, writes logs, fetches `origin/main`,
and synchronizes the clean checkout to that revision. It is not a read-only Git
inspection. A dirty checkout aborts before synchronization.

Once the target and plan match the authorized release:

```bash
./scripts/deploy/main.sh
curl -fsS https://be-original.ca/health
curl -fsS https://be-original.ca/ > /dev/null
```

The script fetches again; recheck its printed target if `main` advanced. Finish
with the same user-facing verification as an automatic release.

For manual container inspection, always name the production Compose file:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 backend nginx
```

The default Compose file runs development services. The deployment script selects
the production file internally; bare manual Compose commands do not.

## Recovery boundaries

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

## Deployment selection and Docker caching

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

The executable owners are [the deployment workflow](../../.github/workflows/deploy.yml)
and [the script entry point](../../scripts/deploy/main.sh), with numbered steps
beside it for synchronization, selection, migration safeguards, replacement, and
cleanup. [CI](ci.md) owns pull-request validation and required checks.
