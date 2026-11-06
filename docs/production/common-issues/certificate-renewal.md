# Renew HTTPS Certificates

Use this guide to verify HTTPS certificate renewal for `be-original.ca` and
`www.be-original.ca`. Establish [SSH access](github/access.md#deployment-access) first.

## Confirm the Certificate Setup

The repository establishes these inputs:

| Configuration | Renewal input |
|---|---|
| [Production Compose](../../../docker-compose.prod.yml) | Mounts host `/etc/letsencrypt` and `/var/www/certbot` into nginx read-only |
| [nginx configuration](../../../nginx.conf) | Serves HTTP ACME challenges from `/var/www/certbot` |
| Certificate files | nginx reads `fullchain.pem` and `privkey.pem` under `/etc/letsencrypt/live/be-original.ca/` for both hostnames |

## Verify the Server Renewal Procedure

The repository does not establish the installed certificate client, renewal
configuration, timer or cron schedule, or post-renewal reload hook. Confirm these
with the server operator before running a renewal or installing automation.

1. Inspect the served certificate's expiry and coverage for both hostnames.
2. Identify the installed certificate client and its renewal configuration.
3. Confirm the exact renewal command, expected result, and failure recovery.
4. Confirm the automatic renewal schedule and nginx reload hook, if configured.

Record the verified mechanism and procedure here. Until then, this guide has no
repository-verified renewal command. Do not guess a command, replace certificate
files manually, or disable TLS verification to hide a failure.

## Verify Renewal and Reload NGINX

After the verified renewal procedure succeeds:

1. Follow [Reload NGINX](nginx-reload.md).
   Reloading nginx makes it read the renewed certificate; a reload alone does
   not renew it.
2. Check the served certificate's new expiry and hostname coverage for both
   `be-original.ca` and `www.be-original.ca`.
3. Confirm the public health endpoint and homepage pass HTTPS verification.

If renewal fails, inspect the installed client's logs and use its verified
recovery procedure. For service or HTTP failures after renewal, follow
[Identify the Failing Boundary](../deployment.md#identify-the-failing-boundary).
