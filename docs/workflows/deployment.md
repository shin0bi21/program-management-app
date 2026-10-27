# Production deployment

Production deploys are automated through GitHub Actions. Pull requests are
fully validated before they can enter `main`; the resulting push to `main`
then runs only the deployment and public production smoke checks.

See [Continuous integration](ci.md) for pull-request checks, failure reproduction, and workflow maintenance. This guide owns the separate continuous-deployment path after a push to `main`.

```text
feature → PR to develop → standard CI
develop → PR to main → standard CI + production image validation
main push → SSH to Lightsail → scripts/deploy/main.sh → public smoke checks
```

## One-time GitHub setup

Open the GitHub repository, then go to:

**Settings → Secrets and variables → Actions → Repository secrets**

Create each value as a separate repository secret. These are not JSON fields
and the secret names must not include colons.

| Name | Production value |
|---|---|
| `LIGHTSAIL_HOST` | `18.216.104.46` |
| `LIGHTSAIL_USER` | `ubuntu` |
| `LIGHTSAIL_APP_PATH` | `/home/ubuntu/my-webapp` |
| `LIGHTSAIL_SSH_KEY` | Complete contents of `~/.ssh/be-original-key.pem` |

The SSH key value must include its opening and closing boundary lines, for
example:

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

The exact boundary text may instead identify an RSA private key. Copy whatever
is present in the key file. Do not include a shell prompt, filename, comments,
or surrounding quotes. Never commit the private key to this repository.

On macOS, copy the complete key to the clipboard with:

```bash
pbcopy < ~/.ssh/be-original-key.pem
```

Paste the result into the `LIGHTSAIL_SSH_KEY` secret value.

Create a GitHub environment named `production`. The deployment workflow uses
this environment so production secrets and optional approval rules can be
scoped independently from pull-request CI.

Repository rulesets enforce the following merge requirements:

- `develop`: require a pull request and require `Lint & Shell Analysis`,
  `Backend — Typecheck, Migrate & Test`, and `Frontend — Typecheck & Build`.
  Changed repository patterns are enforced inside `Lint & Shell Analysis`.
- `main`: require a pull request, require the merge-path job that rejects
  sources other than `develop`, require `Lint & Shell Analysis`,
  `Backend — Typecheck, Migrate & Test`, and `Frontend — Typecheck & Build`,
  allow only a regular merge commit so `develop` remains in production history,
  and also require
  `Production Compose Validation`, `Backend Production Image`, and
  `Frontend Production Image`.

The production validation jobs are always present on pull requests to `main`.
They are conditional on relevant package, container, nginx, Compose, or
deployment changes for pull requests to `develop`.

## CI and automatic deployment

Pull-request validation is defined in
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). It runs only for pull
requests targeting `develop` or `main`; merge pushes do not repeat the same
test suite.

Every pull request runs:

- Merge-path enforcement for `main`.
- ESLint, shell syntax checks, ShellCheck, and changed repository patterns.
- Backend typechecking, clean-database migrations, checksum validation,
  generated database-type drift detection, API tests, and build.
- Frontend tests, typechecking, and build.

Production containers are also built when a pull request targets `main`, or
when a pull request to `develop` changes a Dockerfile, production Compose or
nginx configuration, deployment script, package manifest, or lockfile.

The deployment workflow is defined in
[`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml). It runs only
for a push to `main`; it does not repeat the pull-request test suites.

The deployment job then:

1. Writes `LIGHTSAIL_SSH_KEY` to a temporary key file on the GitHub runner.
2. Connects to `LIGHTSAIL_USER@LIGHTSAIL_HOST`.
3. Changes into `LIGHTSAIL_APP_PATH`.
4. Refuses to continue if the server repository has uncommitted changes.
5. Synchronizes the server checkout to `origin/main`.
6. Runs `./scripts/deploy/main.sh`.
7. Requests the public `/health` endpoint and homepage over HTTPS, retrying
   briefly while the replacement containers become externally reachable.

The smart deployment script compares the target commit with the last successful
frontend, backend, and infrastructure revisions in `.deploy-state/`. It then
selects the smallest safe flow:

| Detected changes | Result |
|---|---|
| Frontend only | Rebuild and replace nginx/frontend |
| Backend only | Rebuild and replace backend, then verify health |
| Database migrations | Snapshot, migrate with rollback protection, then deploy backend |
| Production infrastructure or shared TypeScript policy | Run the conservative full deployment flow |
| Documentation/development tooling only | Do not rebuild production containers |

Missing revision markers cause a full deployment. This is expected on the first
run after revision tracking is introduced.

### Deployment selection and Docker caching

Production deployment avoids unnecessary work at two independent levels:

1. The deployment script compares the target commit with the last successfully
   deployed frontend, backend, and infrastructure revisions. This selects the
   smallest safe deployment flow and avoids invoking unrelated image builds.
2. When a selected flow invokes `docker compose build`, Docker evaluates each
   Dockerfile layer against its local build cache. A matching layer is reused;
   a changed layer and the layers after it are rebuilt.

The second level is Docker behavior, not another Git change classifier. A
conservative full deployment deliberately invokes both image builds, database
safeguards, and both service replacements. The image builds can still complete
quickly when Docker reuses their layers.

For example, `nginx.conf` is classified as production infrastructure, so it
selects the full flow. The file is mounted into the nginx container rather than
copied into either application image. If application inputs are unchanged, the
backend and frontend image layers normally remain reusable even though both
build commands run. The deployment still performs the full database-safety and
service-replacement sequence.

Both production Dockerfiles copy package manifests before application source:

```text
copy package.json and package-lock.json
run npm ci
copy application source
run the TypeScript or frontend build
```

This ordering gives dependencies and application compilation separate cache
boundaries:

- A source-only change reuses the `npm ci` layer and reruns compilation.
- A package manifest or lockfile change reruns `npm ci` and all later layers in
  that build stage.
- A relevant Dockerfile instruction, base-image state, or missing/pruned local
  build cache can require more of the image to be rebuilt.
- An unrelated component is not built at all when the first-level deployment
  classification can safely exclude it.

`npm ci` runs while Docker builds an image, not whenever a production container
starts. The backend Dockerfile has separate dependency-install layers for its
builder and production stages; the frontend Dockerfile has one in its builder
stage. A cache hit skips the corresponding command entirely. Runtime containers
start from the completed images.

Consequently, two deployments classified as full can have materially different
durations. A warm-cache full deployment may reuse nearly every image layer,
whereas a cold or invalidated build must reinstall dependencies and compile both
applications. `Full` describes the safety flow that was selected; it does not
mean `--no-cache` or guarantee that every Dockerfile command executes.

## Monitoring and rerunning a deployment

In GitHub, open **Actions → Deploy Production**, then select the workflow run
for the `main` commit. A successful production run shows these steps as green:

- Deploy via SSH
- Verify public production routes

If deployment fails because secrets were missing, add the secrets and use
**Re-run jobs → Re-run failed jobs**. A new commit is not required.

An empty-key configuration is visible in the deployment log as an empty key
write, an SSH destination of `@`, or an empty `cd` path. Verify all four secret
names and values if that occurs.

## Manual access and deployment

Connect from a machine that has the private key:

```bash
ssh -i ~/.ssh/be-original-key.pem ubuntu@18.216.104.46
```

Run the deployment manually when required:

```bash
cd /home/ubuntu/my-webapp
./scripts/deploy/main.sh
```

Preview what the smart deployment would do without changing containers, the
database, or revision markers:

```bash
cd /home/ubuntu/my-webapp
./scripts/deploy/main.sh --plan
```

Deployment logs are written to `logs/deploy.log` by default.

## Troubleshooting checklist

1. Confirm the release pull request passed its backend, frontend, quality, and
   production-container jobs.
2. Confirm all four GitHub repository secrets exist with exact names.
3. Confirm `/home/ubuntu/my-webapp` exists and is the production checkout.
4. Confirm the server worktree is clean with `git status --short`.
5. Confirm the server can fetch `origin/main`.
6. Review `logs/deploy.log` on Lightsail.

If SSH succeeds but fetching GitHub fails with `Invalid username or token`, follow
[Renew the production server's GitHub access](github-credentials.md).

The executable entry point is
[`scripts/deploy/main.sh`](../../scripts/deploy/main.sh). Its supporting steps
are the numbered files in the same directory, including change classification,
database safeguards, service replacement, and rollback cleanup.

## Dependency and security automation

Dependabot checks npm dependencies in the root, backend, and frontend, plus
GitHub Actions and Docker base images, on a weekly schedule. Its configuration
lives in [`.github/dependabot.yml`](../../.github/dependabot.yml).

GitHub Dependency Review and CodeQL are not configured because this private
repository does not currently have GitHub Advanced Security. If that feature
is enabled later, add Dependency Review to pull requests and enable CodeQL for
`javascript-typescript`; keep those scans outside the production deployment
critical path.
