# Restore Verification Email

Connect using [SSH access](github/access.md#deployment-access) and run server
commands from `/home/ubuntu/my-webapp` on Lightsail.

<a id="restore-verification-email"></a>

Use this procedure when backend logs show Gmail SMTP `EAUTH` / `535 5.7.8`
credential rejection while sending the two-factor sign-in code. This identifies
a server email credential failure, not an incorrect application-user password. Trace the
request ID and underlying cause before replacing credentials.

The [email transport](../../../backend/src/utils/emailService.ts) uses Gmail with
`EMAIL_USER` and `EMAIL_PASS`. For the sending account's App Password setup:

1. Sign into that Google account and generate a replacement
   [App Password](https://myaccount.google.com/apppasswords).
2. Follow [Update Server Environment](../environment.md) to replace only
   `EMAIL_PASS`, without grouping spaces, and load the updated settings. That
   procedure includes recreating the backend and reloading nginx.
3. Retry login and confirm the verification email arrives. Health verifies
   backend/database connectivity, not email delivery.

## If a Command or Email Delivery Fails

Read any terminal error, then inspect recent backend logs on Lightsail:

```bash
docker compose -f docker-compose.prod.yml logs --since=5m --tail=100 backend
```

Use the SMTP error and request ID to check the sending account and credentials
before retrying.

If health checks pass but email still fails, investigate the SMTP error rather
than repeatedly recreating containers. Restore a previous credential only if it
is still valid. [Google's App Password guidance](https://support.google.com/accounts/answer/185833)
explains account requirements and revocation after account-password changes.
