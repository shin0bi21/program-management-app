# Renew the production server's GitHub access

Use this procedure when the Lightsail server cannot fetch the private repository
and reports `Invalid username or token` or `Authentication failed` for GitHub.
GitHub does not accept account passwords for Git over HTTPS; the password prompt
expects a personal access token.

This is the server's access to GitHub. It is separate from the
`LIGHTSAIL_SSH_KEY` secret used by GitHub Actions to connect to the server.

## Create a replacement token

1. In GitHub, open **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. Give it a descriptive name, such as `Lightsail repository read access`, and
   choose an expiration date. Record when it will need renewal.
3. Select the repository owner `shin0bi21`.
4. Under **Repository access**, choose **Only select repositories**, then
   `be-original`.
5. Under **Repository permissions**, select **Contents → Read-only**.
   **Metadata → Read-only** is included automatically. No other permissions are
   needed for fetching the repository.
6. Generate the token and save it in your password manager. GitHub only displays
   the token value once.

## Verify access on Lightsail

In your existing SSH session on the server, run:

```bash
cd ~/my-webapp
git -c credential.helper= fetch origin main
```

At the prompts, enter:

- **Username:** `shin0bi21`
- **Password:** paste the new token, not your GitHub account password.

The terminal does not display the token as you paste. A successful fetch confirms
that the token can read the repository. The command disables credential helpers
for this invocation, so it neither uses a stale saved credential nor saves the
replacement token.

Never paste tokens into chat, documentation, remote URLs, or shell command
arguments. Keep them out of Git and logs.

## Resume the authorized deployment

For a production deployment that has already been authorized, run from the
repository root:

```bash
cd ~/my-webapp
./scripts/deploy/main.sh
```

If Git prompts again, enter the new token. The filename is `main.sh`.
Follow the [deployment guide](deployment.md#monitoring-and-rerunning-a-deployment)
for monitoring and public verification. A successful fetch alone does not confirm
that a deployment succeeded.

## Automated deployment follow-up

The interactive test above does **not** configure persistent authentication.
GitHub Actions runs noninteractively and cannot answer a password prompt.
Before rerunning a failed Actions deployment, configure and verify the server's
noninteractive repository authentication, for example with a repository-scoped,
read-only SSH deploy key or an appropriate credential manager.

This procedure covers token creation and an interactive fetch. Persistent
authentication and successful production deployment require separate verification.
After a replacement is configured and verified, revoke the superseded
token if it is still active and no other service needs it.

## Further reading

- [GitHub: Managing personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Git: Credential helpers](https://git-scm.com/docs/gitcredentials)
