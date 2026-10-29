# Restore Verification Email

Follow the [production operating rules](README.md) and establish
[SSH access](access.md#deployment-access) before starting.

<a id="restore-verification-email"></a>

Use this procedure when backend logs show Gmail SMTP `EAUTH` / `535 5.7.8`
credential rejection while sending a verification code. This identifies a server
email credential failure, not an incorrect application-user password. Trace the
request ID and underlying cause before replacing credentials.

The [email transport](../../../backend/src/utils/emailService.ts) uses Gmail with
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

3. Follow [Validate and Reload NGINX](nginx-and-tls.md#validate-and-reload-nginx).
   That procedure verifies backend health before validating and reloading nginx
   so it resolves the replacement backend container, then checks public health.

4. Retry login and confirm the verification email arrives. Health verifies
   backend/database connectivity, not email delivery.

Always specify `-f docker-compose.prod.yml` for manual production Compose
commands; the default file starts development services. If recreation or health
fails, stop and inspect the production logs before retrying. Restore a previous
credential only if it is known valid; a revoked password cannot be a rollback.
If health passes but email still fails, check the sending account and SMTP error
instead of repeatedly rebuilding services. [Google's App Password guidance](https://support.google.com/accounts/answer/185833)
explains account requirements and revocation after account-password changes.
