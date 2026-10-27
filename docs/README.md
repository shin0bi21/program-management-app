# Documentation website

This directory contains both the canonical developer guides and a standalone
Starlight website. The application continues to build and deploy only its frontend
and backend; documentation hosting has no application role, database, or runtime
dependency on AWS.

## Local use

The docs service is part of the local Docker environment and needs no Cloudflare
account or deployed website. From the repository root:

```bash
docker compose up -d docs
docker compose logs -f docs
```

Open `http://localhost:4321`. Markdown edits reload automatically. The first start
installs dependencies into a dedicated named volume; subsequent starts reuse them
and can run offline. After changing the docs lockfile, run
`docker compose exec docs npm ci` and restart the docs service.

To verify the searchable production build locally, run a temporary preview container:

```bash
docker compose exec docs npm test
docker compose run --rm --no-deps -p 127.0.0.1:4322:4321 docs sh -c 'npm run build && npm run preview -- --host 0.0.0.0 --port 4321'
```

Starlight's Pagefind search is generated during the production build; test search
at `http://localhost:4322`. Local development and preview do not provide authentication;
Docker publishes these ports on localhost only. Alternatively, Node 24 users can
run `npm ci` and the `dev`, `test`, `build`, and `preview` scripts directly in `docs/`.

## Content ownership

Edit the existing files in `backend/`, `frontend/`, and `workflows/`. The repository
root README provides the site's overview; this file describes the website itself.
Build tooling derives Starlight content in ignored `src/content/docs/`, adding
titles and translating repository links into website routes. Never edit or commit
those generated copies.

The website preserves code blocks and tables. Mermaid diagrams are currently
shown as source code. Source-file links open the private GitHub repository and
require repository access. `DOCS_GIT_REF` controls the GitHub ref used for those
links; production defaults to `main`.

Only this README, the repository root README, and the three documentation areas
are included. Environment files, application source, dependencies, and agent
instructions are not copied into the site.

## Cloudflare hosting and access

The intended host is `docs.be-original.ca` on Cloudflare Pages. Use the same private
Git repository, with **root directory `docs`**, **build command `npm run build`**,
**output directory `dist`**, and **Node version 24**. Production should follow
`main`; previews can build other branches after access protection is verified.
Builds must include the full repository checkout because content links and the
overview reference files outside this directory.

Before uploading internal content, configure Cloudflare Access to allow only
approved developer identities. Protect the entire custom hostname, including
assets and Pagefind search indexes. Protect or disable alternate production
`pages.dev`, branch, and preview URLs too. Cloudflare's preview Access setting
alone does not protect the production custom domain.

Verify protection first with a harmless placeholder deployment: signed-out and
unauthorized visitors must not retrieve pages or search assets through any URL;
approved developers must be able to sign in and search. Only then deploy the real
documentation. `robots.txt`, noindex metadata, and private-cache headers are
supplementary controls, not authentication.

Cloudflare account connection, DNS, Access policies, and publishing are separate
operational steps. The local project does not create them automatically.

## Further reading

- [Starlight documentation](https://starlight.astro.build/)
- [Cloudflare Pages: Astro](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/)
- [Cloudflare Pages: Access limitations and alternate domains](https://developers.cloudflare.com/pages/platform/known-issues/)
- [Cloudflare Access: Web applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/)
