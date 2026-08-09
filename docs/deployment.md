# Production Deployment

Production deploys are automated through GitHub Actions. A push to `main`
must pass the backend and frontend CI jobs before GitHub connects to the
Lightsail server and runs the repository deployment script.

```text
develop → pull request → main → CI passes → SSH to Lightsail → scripts/deploy.sh
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

## Automatic deployment

The workflow is defined in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
Its deployment job runs only for a `push` event on `main`, after both of these
jobs pass:

- Backend — Typecheck, Migrate & Test
- Frontend — Typecheck & Build

The deployment job then:

1. Writes `LIGHTSAIL_SSH_KEY` to a temporary key file on the GitHub runner.
2. Connects to `LIGHTSAIL_USER@LIGHTSAIL_HOST`.
3. Changes into `LIGHTSAIL_APP_PATH`.
4. Refuses to continue if the server repository has uncommitted changes.
5. Synchronizes the server checkout to `origin/main`.
6. Runs `./scripts/deploy.sh`.

The smart deployment script compares the target commit with the last successful
frontend, backend, and infrastructure revisions in `.deploy-state/`. It then
selects the smallest safe flow:

| Detected changes | Result |
|---|---|
| Frontend only | Rebuild and replace nginx/frontend |
| Backend only | Rebuild and replace backend, then verify health |
| Database migrations | Snapshot, migrate with rollback protection, then deploy backend |
| Production infrastructure | Run the conservative full deployment flow |
| Documentation/development tooling only | Do not rebuild production containers |

Missing revision markers cause a full deployment. This is expected on the first
run after revision tracking is introduced.

## Monitoring and rerunning a deployment

In GitHub, open **Actions → CI**, then select the workflow run for the `main`
commit. A successful production run shows all of these jobs as green:

- Enforce develop → main only
- Backend — Typecheck, Migrate & Test
- Frontend — Typecheck & Build
- Deploy to Lightsail

If the code checks pass but the deployment fails because secrets were missing,
add the secrets and use **Re-run jobs → Re-run failed jobs**. A new commit is not
required.

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
./scripts/deploy.sh
```

Preview what the smart deployment would do without changing containers, the
database, or revision markers:

```bash
cd /home/ubuntu/my-webapp
./scripts/deploy.sh --plan
```

Deployment logs are written to `logs/deploy.log` by default.

## Troubleshooting checklist

1. Confirm the `main` backend and frontend jobs passed.
2. Confirm all four GitHub repository secrets exist with exact names.
3. Confirm `/home/ubuntu/my-webapp` exists and is the production checkout.
4. Confirm the server worktree is clean with `git status --short`.
5. Confirm the server can fetch `origin/main`.
6. Review `logs/deploy.log` on Lightsail.

For the implementation, classification rules, and rollback behavior, see
[`scripts/deploy.sh`](../scripts/deploy.sh).
