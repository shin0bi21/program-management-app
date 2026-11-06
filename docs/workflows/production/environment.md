# Update Server Environment

Use this procedure to add or change backend settings, such as an integration API
key or email password, in the production server's root `.env` file.

## Edit the Server File

1. Connect using [SSH Access to the Server](common-issues/github/access.md#deployment-access).
2. Open the existing production file:

   ```bash
   cd /home/ubuntu/my-webapp
   nano .env
   ```

3. Add or replace the required setting, keeping one `NAME=value` per line.
   Preserve the other production values. Keep secrets out of frontend `VITE_`
   settings, which are exposed to the browser.
4. Save with **Ctrl+O**, press **Enter**, then exit with **Ctrl+X**.

## Load the Updated Settings

From `/home/ubuntu/my-webapp` on the server, recreate the backend:

```bash
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate backend
```

This replaces the backend container and briefly interrupts backend requests.
Use container recreation rather than restart to load the new values.

Follow [Reload NGINX](common-issues/nginx-reload.md) to check backend health, reload
nginx's connection to the replacement container, and check public health.

## Verify the Affected Feature

Test the feature that uses the changed setting. A successful health check confirms
the backend and database are reachable; it does not verify an integration API key
or email delivery.

For a two-factor sign-in email problem, use
[Restore Verification Email](common-issues/email-recovery.md) for the credential
setup and email-specific checks.

If the backend or feature fails, inspect recent logs on the server:

```bash
docker compose -f docker-compose.prod.yml logs --tail=100 backend
```

Check the setting name and value against the integration's requirements. If you
restore a previous value that is still valid, repeat the container recreation,
nginx reload, and feature check above.

Database password changes also require updating the database account itself;
editing `.env` alone does not change an existing database password.
