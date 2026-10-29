# Inspect NGINX and TLS

Use this runbook for a proxy failure, a rejected nginx configuration, or a
certificate problem. Follow the [production operating rules](README.md) and
establish [SSH access](access.md#deployment-access) first.

## Identify the Failing Boundary

From an authorized workstation, check the public routes without disabling TLS
verification:

```bash
curl -fsS https://be-original.ca/health
curl -fsS https://be-original.ca/ > /dev/null
```

Record whether the failure is DNS/connectivity, certificate validation, or an
HTTP response. On Lightsail, inspect service state, recent logs, and configuration:

```bash
cd /home/ubuntu/my-webapp
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 nginx backend
docker compose -f docker-compose.prod.yml exec -T nginx nginx -t
```

If nginx is stopped, its logs are the starting point; `exec` requires a running
container. If the backend is unhealthy, resolve that failure before treating
the proxy as its cause. For a failed release, follow
[deployment recovery](../delivery/deployment.md#recovery-boundaries).

## Validate and Reload NGINX

After an authorized configuration or certificate repair, or after replacing a
healthy backend container, validate before reloading:

```bash
docker compose -f docker-compose.prod.yml exec -T backend curl -fsS http://localhost:5001/health &&
  docker compose -f docker-compose.prod.yml exec -T nginx nginx -t &&
  docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload &&
  curl -fsS https://be-original.ca/health
```

The chain stops on failure. Inspect the failing step and its service logs before
retrying; do not reload a rejected configuration. Verify the public homepage and
the affected application action afterward. A reload does not renew a certificate.

## Certificate Renewal: Server Verification Required

The repository establishes these inputs:

- [Production Compose](../../../docker-compose.prod.yml) mounts host
  `/etc/letsencrypt` and `/var/www/certbot` into nginx read-only.
- [nginx configuration](../../../nginx.conf) serves HTTP ACME challenges from
  `/var/www/certbot` and uses the certificate and private key under
  `/etc/letsencrypt/live/be-original.ca/` for the configured hostnames.

It does not establish the installed certificate client, renewal configuration,
timer or cron schedule, or post-renewal reload hook. Confirm those with the server
operator before running a renewal or installing automation. Inspect the served
certificate's expiry and hostname coverage as part of that investigation.

Once verified, document the installed mechanism, exact renewal procedure,
expected result, nginx reload hook, and failure recovery here. Until then, there
is no repository-verified renewal command. Do not guess a renewal command,
replace certificate files manually, or disable TLS verification to hide a failure.
