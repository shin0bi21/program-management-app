# Documentation website

This directory contains both the canonical developer guides and a standalone
Starlight website. The application continues to build and deploy only its frontend
and backend; documentation hosting has no application role, database, or runtime
dependency on AWS.

## Local use

The docs service is part of the local Docker environment and needs no hosted
service or deployed website. From the repository root:

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
those generated copies. Page titles preserve the authored heading, including casing.

The [navigation map](scripts/navigation.mjs) groups guides by reader task without
requiring matching folders or changing their URLs. Add every published guide to
that map exactly once; generation rejects missing, duplicate, and unknown entries.
Keep labels brief and use sentence case. Use the existing area overview to route
readers rather than adding an index file for every navigation group.

When merging or moving a guide, update repository links and skill references in the
same change. Add its former website route to `redirects` in
[the site configuration](astro.config.mjs), pointing to the relevant section where
appropriate. Preserve linked section IDs or update their callers; a page redirect
alone does not repair a renamed heading. Run both the repository link check and
the docs build, which checks rendered targets and anchors.

The website preserves code blocks and tables. Mermaid diagrams are currently
shown as source code. Source-file links open the private GitHub repository and
require repository access. `DOCS_GIT_REF` controls the GitHub ref used for those
links; it defaults to `main`.

Only this README, the repository root README, and the three documentation areas
are included. Environment files, application source, dependencies, and agent
instructions are not copied into the site.

## Write and maintain a guide

Give each guide one reader purpose: explain an architectural decision, define a
shared contract, or walk through a task. Split when those purposes or audiences
differ; merge thin guides that describe one responsibility. Keep ownership rules
in their owner guide and link to them from consumers and agent skills.

Keep implementation details in source and tests unless the reader needs them to
make a decision. Document meaningful constraints and the reason for exceptions;
avoid parallel endpoint inventories, styling values, or historical incident
narratives in current instructions. Operational tasks identify the environment,
prerequisites, steps, expected results, outcome verification, and recovery path.
Update the applicable guide in the same change as its contract or procedure.

## Further reading

- [Starlight documentation](https://starlight.astro.build/)
