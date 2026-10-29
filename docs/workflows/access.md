# Production access and credential recovery

Use this guide for authorized production access setup or credential recovery.
Run server commands only in `/home/ubuntu/my-webapp` on Lightsail. Keep tokens,
private keys, and email passwords out of Git, chat, logs, remote URLs, and shell
arguments. Never overwrite unrelated `.env` values while replacing a credential.

| Failure or task | Credential owner | Procedure |
|---|---|---|
| Missing deployment secret or SSH connection failure | GitHub Actions → Lightsail | [Deployment access](#deployment-access) |
| SSH works but GitHub fetch fails | Lightsail → private GitHub repository | [Server GitHub access](#server-github-access) |
| Login fails while sending its verification email | Backend → Gmail SMTP | [Restore verification email](#restore-verification-email) |

## Deployment access

In the GitHub repository, open **Settings → Secrets and variables → Actions →
Repository secrets**. Configure each value separately:

| Name | Production value |
|---|---|
| `LIGHTSAIL_HOST` | `18.216.104.46` |
| `LIGHTSAIL_USER` | `ubuntu` |
| `LIGHTSAIL_APP_PATH` | `/home/ubuntu/my-webapp` |
| `LIGHTSAIL_SSH_KEY` | Complete contents of the authorized `~/.ssh/be-original-key.pem` |

Copy the entire key, including its opening and closing boundary lines. Do not
include a shell prompt, filename, or surrounding quotes. On macOS:

```bash
pbcopy < ~/.ssh/be-original-key.pem
```

Create the GitHub environment `production`, which the deployment job uses for
environment protection rules and environment-scoped secrets when configured.
Configure the [required checks](ci.md#required-checks) in repository rulesets.

From an authorized workstation, verify manual server access:

```bash
ssh -i ~/.ssh/be-original-key.pem ubuntu@18.216.104.46
```

Successful SSH confirms workstation access; the deployment job must also verify
the Actions secret. Follow [deployment monitoring](deployment.md#monitoring-and-rerunning-a-deployment)
for an already authorized release. If access still fails, diagnose the reported
secret, key, host, or SSH error before changing application containers.

## Server GitHub access

Use this procedure when a fetch reports `Invalid username or token` or
`Authentication failed`. This credential is separate from `LIGHTSAIL_SSH_KEY`.
An HTTPS password prompt expects a personal access token, not an account password.

### Create a replacement token

1. In GitHub, open **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. Name it for Lightsail repository read access, choose an expiration, and
   record when renewal will be needed.
3. Select owner `shin0bi21`, **Only select repositories**, and `be-original`.
4. Grant **Contents → Read-only**; **Metadata → Read-only** is automatic.
5. Save the generated value in your password manager; GitHub displays it once.

### Verify access on Lightsail

In the server SSH session:

```bash
cd /home/ubuntu/my-webapp
git -c credential.helper= fetch origin main
```

Enter `shin0bi21` as username and paste the token at the password prompt. It is
not displayed. A successful fetch proves repository read access for that token.
The command disables credential helpers for this invocation: it neither uses a
stale saved credential nor saves the replacement.

<a id="resume-the-authorized-deployment"></a>

### Automated deployment follow-up

The checked-in workflow performs a noninteractive `git fetch` on the server; it
does not provision persistent repository credentials. The interactive check
above therefore does not repair unattended deployment. Confirm the server's
existing authentication mechanism with its operator, renew it through that
mechanism, and verify it without a prompt before rerunning Actions:

```bash
GIT_TERMINAL_PROMPT=0 git fetch origin main </dev/null
```

Run that check as the same server user in `/home/ubuntu/my-webapp`. If it fails,
stop and resolve the credential setup; do not put a token in the remote URL or
assume an interactive fetch has fixed it. The repository does not establish
which persistent mechanism is installed on the server.

After access and the authorized deployment are verified, revoke superseded
tokens only when no other service depends on them. Fetch success alone does not
prove deployment success. See [GitHub token guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
and [Git credential helpers](https://git-scm.com/docs/gitcredentials).

## Restore verification email

Use this procedure when backend logs show Gmail SMTP `EAUTH` / `535 5.7.8`
credential rejection while sending a verification code. This identifies a server
email credential failure, not an incorrect application-user password. Trace the
request ID and underlying cause before replacing credentials.

The [email transport](../../backend/src/utils/emailService.ts) uses Gmail with
`EMAIL_USER` and `EMAIL_PASS`. For the sending account's App Password setup:

1. Sign into that Google account and generate a replacement
   [App Password](https://myaccount.google.com/apppasswords).
2. On Lightsail, edit `/home/ubuntu/my-webapp/.env` and replace only `EMAIL_PASS`,
   without grouping spaces. A container restart will not reload Compose
   `env_file` values; recreate the backend:

   ```bash
   cd /home/ubuntu/my-webapp
   docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate backend
   ```

3. Confirm backend health. Only after it succeeds, validate and reload nginx so
   it resolves the replacement backend container:

   ```bash
   docker compose -f docker-compose.prod.yml logs --tail=50 backend
   docker compose -f docker-compose.prod.yml exec -T backend curl -fsS http://localhost:5001/health &&
     docker compose -f docker-compose.prod.yml exec -T nginx nginx -t &&
     docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload &&
     curl -fsS https://be-original.ca/health
   ```

4. Retry login and confirm the verification email arrives. Health verifies
   backend/database connectivity, not email delivery.

Always specify `-f docker-compose.prod.yml` for manual production Compose
commands; the default file starts development services. If recreation or health
fails, stop and inspect the production logs before retrying. Restore a previous
credential only if it is known valid; a revoked password cannot be a rollback.
If health passes but email still fails, check the sending account and SMTP error
instead of repeatedly rebuilding services. [Google's App Password guidance](https://support.google.com/accounts/answer/185833)
explains account requirements and revocation after account-password changes.
