# Reload NGINX

Connect using [SSH access](github/access.md#deployment-access) and run these
commands from `/home/ubuntu/my-webapp` on Lightsail.

This command is useful when:

- You've renewed or repaired the HTTPS certificate.
- You've updated the nginx configuration.
- You've replaced the backend container and confirmed it is healthy.

```bash
docker compose -f docker-compose.prod.yml exec -T backend curl -fsS http://localhost:5001/health &&
  docker compose -f docker-compose.prod.yml exec -T nginx nginx -t &&
  docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload &&
  curl -fsS https://be-original.ca/health
```

## If a Command Fails

If a command fails, the remaining commands do not run. Read the terminal error,
then run this on Lightsail with Node 24 available:

```bash
node scripts/reports/log-report.ts --docker nginx backend --since 5m --context 0
```

This summarizes recent server logs. Repeated messages appear once, with a count.
Use it alongside the terminal error to decide what to check next. See
[Log Report](../../delivery/reports.md#log-report) for more options.

## After Reloading

Check that the public homepage and affected feature work. Reloading nginx loads
the certificate files already on the server; it does not renew them.
