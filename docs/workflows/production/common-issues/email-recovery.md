# Restore Verification Email

Connect using [SSH access](github/access.md#deployment-access) and run server
commands from `/home/ubuntu/my-webapp` on Lightsail.

<a id="restore-verification-email"></a>

Use this procedure when backend logs show Gmail SMTP `EAUTH` / `535 5.7.8`
credential rejection while sending a verification code. This identifies a server
email credential failure, not an incorrect application-user password. Trace the
request ID and underlying cause before replacing credentials.

The [email transport](../../../../backend/src/utils/emailService.ts) uses Gmail with
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

3. Follow [Reload NGINX](nginx-reload.md).
   That procedure verifies backend health before validating and reloading nginx
   so it resolves the replacement backend container, then checks public health.

4. Retry login and confirm the verification email arrives. Health verifies
   backend/database connectivity, not email delivery.

## If a Command or Email Delivery Fails

Read any terminal error, then run this on Lightsail with Node 24 available:

```bash
node scripts/reports/log-report.ts --docker backend --since 5m --context 0
```

This summarizes recent backend logs. Repeated messages appear once, with a count.
Use the SMTP error and request ID to check the sending account and credentials
before retrying. See [Log Report](../../delivery/reports.md#log-report) for more options.

If health checks pass but email still fails, investigate the SMTP error rather
than repeatedly recreating containers. Restore a previous credential only if it
is still valid. [Google's App Password guidance](https://support.google.com/accounts/answer/185833)
explains account requirements and revocation after account-password changes.
