# Restore Server GitHub Authentication

Follow the [production operating rules](README.md) and establish
[SSH access](access.md#deployment-access) before starting. This procedure
repairs repository access; it does not authorize a deployment.

## Server GitHub Access

Use this procedure when a fetch reports `Invalid username or token` or
`Authentication failed`. This credential is separate from `LIGHTSAIL_SSH_KEY`.
An HTTPS password prompt expects a personal access token, not an account password.

### Create a Replacement Token

1. In GitHub, open **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. Name it for Lightsail repository read access, choose an expiration, and
   record when renewal will be needed.
3. Select owner `shin0bi21`, **Only select repositories**, and `be-original`.
4. Grant **Contents → Read-only**; **Metadata → Read-only** is automatic.
5. Save the generated value in your password manager; GitHub displays it once.

### Verify Access on Lightsail

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

### Automated Deployment Follow-Up

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
