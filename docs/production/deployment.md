# Deploy to Production

Release through a pull request from `develop` to `main`; merging it automatically
deploys production. Deployment requires separate authorization from feature shipping.
For direct server deployment, use [Manual Deployment](#manual-deployment).

Run server commands from `/home/ubuntu/my-webapp` on Lightsail. For manual container
operations, use `docker compose -f docker-compose.prod.yml`; the default Compose
file starts development services.

<a id="release-to-production"></a>

## Automatic Deployment

1. Confirm the approved release scope is merged into `develop`, its checks have
   passed, and migration or operational prerequisites are understood. Resolve
   outstanding production-access failures before merging the release.
   A release retiring migration history must complete the
   [collapse bootstrap and baseline reuse](../workflows/delivery/collapse-database.md#reuse-the-reviewed-baseline-on-another-environment)
   before ordinary deployment runs migration validation.
2. Open a release pull request from `develop` to `main`. Review its complete diff
   and wait for the [required checks](../workflows/delivery/ci.md#required-checks), including production
   image and Compose validation.
3. Merge with a regular merge commit so `develop` remains in production history.
   Do not squash or rebase the release. Record the resulting `main` commit.
4. In **Actions → Deploy Production**, open the run for that commit. Wait for
   **Deploy via SSH** and **Verify public production routes** to succeed.
5. Complete [Verify the Deployment](#verify-the-deployment).

<a id="manual-access-and-deployment"></a>

## Manual Deployment

Follow [Configure SSH Access to the Server](common-issues/github/access.md) before connecting. Connect from
the workstation holding the authorized key:

```bash
ssh -i ~/.ssh/be-original-key.pem ubuntu@18.216.104.46
```

On Lightsail, enter the production checkout and inspect it:

```bash
cd /home/ubuntu/my-webapp
git status --short
./scripts/deploy/main.sh --preview
```

Preview prints the latest remote `main` target and selected work without changing
services, data, or the checkout. Local edits are excluded; deployment requires a
clean checkout. Resolve any local edits and check the printed target before continuing.

Once the preview target and selected work match the authorized release:

```bash
./scripts/deploy/main.sh
```

The script fetches again; recheck its printed target if `main` advanced. Finish
with [Verify the Deployment](#verify-the-deployment).

## Verify the Deployment

From your workstation or the server, check the public routes without disabling
TLS verification:

```bash
curl -fsS https://be-original.ca/health
curl -fsS https://be-original.ca/ > /dev/null
```

Check the changed user-facing behavior in production. These public responses are
smoke checks; they do not prove that authenticated actions or external integrations
work. If a check fails, use [Identify the Failing Boundary](#identify-the-failing-boundary).

<a id="ci-and-automatic-deployment"></a>
<a id="troubleshooting-checklist"></a>

## Monitoring and Rerunning a Deployment

Record the failed job/step and target commit before retrying.

For credential or service failures, use the [common issue guides](README.md#common-issues).
For a dirty server checkout, preserve the edits and resolve their ownership before
retrying. For build, migration, or service replacement failures, inspect the failed
step and `logs/deploy.log` on Lightsail.

After correcting a configuration or transient failure for an authorized release,
use **Re-run jobs → Re-run failed jobs**. A new commit is not needed. Check whether
`main` has advanced first: the deployment fetches current `origin/main`, so rerunning
an older Actions run can deploy newer code. Confirm that target is authorized.

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

## Identify the Failing Boundary

Start with the [public HTTPS checks](#verify-the-deployment).

For certificate validation failures, follow [Renew HTTPS Certificates](common-issues/certificate-renewal.md).
For DNS/connectivity or HTTP failures, inspect the failing service. On Lightsail:

```bash
cd /home/ubuntu/my-webapp
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 nginx backend
docker compose -f docker-compose.prod.yml exec -T nginx nginx -t
```

If nginx is stopped, its logs are the starting point; `exec` requires a running
container. If the backend is unhealthy, resolve that failure before treating
the proxy as its cause. For a failed release, follow
[deployment recovery](#recovery-boundaries).

## Deployment Selection and Docker Caching

The script compares the target commit with the last successful frontend, backend,
and infrastructure revisions in `.deploy-state/`:

| Change | Selected work |
|---|---|
| Frontend | Build and replace nginx/frontend |
| Backend | Build, validate migrations, replace backend, and check health |
| Database files (including schema/data init and baseline manifest) | Snapshot and apply migrations before backend replacement |
| Production infrastructure | Conservative full flow |
| Recognized documentation, local-test, data-refresh, or report tooling paths only | No production container rebuild |

Unknown paths and missing revision markers select the full flow. A selected build
can reuse Docker layers; a full flow does not mean a `--no-cache` build.
