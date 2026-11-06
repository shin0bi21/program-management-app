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

Read any terminal error, then run this on Lightsail with Node 24 available:

```bash
node scripts/reports/log-report.ts --docker --production backend --since 5m --context 0
```

Use the SMTP error and request ID to check the sending account and credentials
before retrying. See the [log report usage](../../../scripts/reports/log-report.ts)
or run `node scripts/reports/log-report.ts --help` for more options.

If health checks pass but email still fails, investigate the SMTP error rather
than repeatedly recreating containers. Restore a previous credential only if it
is still valid. [Google's App Password guidance](https://support.google.com/accounts/answer/185833)
explains account requirements and revocation after account-password changes.
