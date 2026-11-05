# Production

Deploy, verify, and troubleshoot the live application. Run server commands from
`/home/ubuntu/my-webapp` on Lightsail.

## Deployment

Use [Deploy to Production](deployment.md) for automatic or manual deployment,
verification, and recovery.

## Common Issues

Listed below are common production issues that have arisen. Use as required.

| Issue or task | Guide |
|---|---|
| Configure deployment secrets or diagnose SSH access | [Configure SSH Access to the Server](common-issues/github/access.md) |
| SSH works but GitHub fetch fails | [Restore Repository Access from the Server](common-issues/github/github-authentication.md) |
| Login fails while sending its verification email | [Restore Verification Email](common-issues/email-recovery.md) |
| Verify HTTPS certificate renewal | [Renew HTTPS Certificates](common-issues/certificate-renewal.md) |
| Reload nginx after a certificate or backend replacement | [Reload NGINX](common-issues/nginx-reload.md) |
