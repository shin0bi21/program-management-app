# Production

Choose a runbook from the observed failure. Routine releases follow
[Deploy, Verify, and Recover](../delivery/deployment.md).

| Failure or task | Guide |
|---|---|
| Configure deployment secrets or diagnose SSH access | [Configure Production Access](access.md) |
| Perform an authorized manual release or recovery | [Admin: Manual Access and Deployment](../admin/manual-deployment.md) |
| SSH works but GitHub fetch fails | [Restore Server GitHub Authentication](github-authentication.md) |
| Login fails while sending its verification email | [Restore Verification Email](email-recovery.md) |
| Investigate nginx, HTTPS, or certificate renewal | [Inspect NGINX and TLS](nginx-and-tls.md) |

## Operating Rules

Run server commands only in `/home/ubuntu/my-webapp` on Lightsail and use
`docker compose -f docker-compose.prod.yml` for manual container operations.
The default Compose file starts development services.

Keep tokens, private keys, and email passwords out of Git, chat, logs, remote
URLs, and shell arguments. Never overwrite unrelated `.env` values while
replacing a credential. Verify the failed boundary before making a change and
verify its recovery afterward; a healthy HTTP endpoint does not prove email
delivery or GitHub authentication.

Access setup and incident recovery do not implicitly authorize a release.
Follow the [deployment workflow](../delivery/deployment.md) for an authorized
release or deployment retry.
