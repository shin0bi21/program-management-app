# Manual Access and Deployment

Use manual deployment only as an administrator carrying out an authorized release or recovery.
Follow [production operating rules](../production/README.md#operating-rules) and
[configure production access](../production/access.md) before connecting. Connect from
the workstation holding the authorized key:

```bash
ssh -i ~/.ssh/be-original-key.pem ubuntu@18.216.104.46
```

On Lightsail, enter the production checkout and inspect it:

```bash
cd /home/ubuntu/my-webapp
git status --short
./scripts/deploy/main.sh --preview
```

Preview fetches the latest remote `main` into a temporary Git repository and
compares it with the recorded component revisions using the current checkout's
deployment tooling. It does not update the checkout, index, refs, deployment
logs/lock, revision markers, images, services, or database, and does not load
`.env`. Temporary Git data is removed on success or failure. Repository transport
settings still apply; a fetch failure stops preview without starting deployment.

Local edits are excluded and produce a notice; actual deployment still rejects
a dirty checkout. Missing revision markers select the full flow without creating
the state directory. Preview is advisory: another deployment or a new `main`
commit can change the later result. It does not execute fetched deployment scripts.
The former `--plan` flag is no longer accepted.

Once the preview target and selected work match the authorized release:

```bash
./scripts/deploy/main.sh
curl -fsS https://be-original.ca/health
curl -fsS https://be-original.ca/ > /dev/null
```

The script fetches again; recheck its printed target if `main` advanced. Finish
with the same user-facing verification as an [automatic release](../delivery/deployment.md#release-to-production).

For manual container inspection, always name the production Compose file:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 backend nginx
```

The default Compose file runs development services. The deployment script selects
the production file internally; bare manual Compose commands do not.

Follow [Recovery Boundaries](../delivery/deployment.md#recovery-boundaries) if deployment fails.
