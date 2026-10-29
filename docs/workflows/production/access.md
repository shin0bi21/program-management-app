# Configure Production Access

Use this guide to configure GitHub Actions and workstation SSH access to
Lightsail. Follow the [production operating rules](README.md) before using
server credentials or changing production.

## Deployment Access

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
Configure the [required checks](../delivery/ci.md#required-checks) in repository rulesets.

From an authorized workstation, verify manual server access:

```bash
ssh -i ~/.ssh/be-original-key.pem ubuntu@18.216.104.46
```

Successful SSH confirms workstation access; the deployment job must also verify
the Actions secret. Follow [deployment monitoring](../delivery/deployment.md#monitoring-and-rerunning-a-deployment)
for an already authorized release. If access still fails, diagnose the reported
secret, key, host, or SSH error before changing application containers.

## Other Credential Failures

<a id="server-github-access"></a>

If SSH works but repository fetches fail, use
[Restore Server GitHub Authentication](github-authentication.md).

<a id="create-a-replacement-token"></a>

For an expired or revoked token, follow
[Create a Replacement Token](github-authentication.md#create-a-replacement-token).

<a id="verify-access-on-lightsail"></a>

After updating credentials, follow
[Verify Access on Lightsail](github-authentication.md#verify-access-on-lightsail).

<a id="resume-the-authorized-deployment"></a>
<a id="automated-deployment-follow-up"></a>

For the release already authorized, follow
[Automated Deployment Follow-Up](github-authentication.md#automated-deployment-follow-up).

<a id="restore-verification-email"></a>

If login fails while sending a verification code, use
[Restore Verification Email](email-recovery.md).
