# Documentation Maintenance

The [project README](../README.md) is the documentation site's homepage. This file
is for maintaining the guides and site in the repository.

## Run the Site

From the repository root:

```bash
docker compose up -d docs
docker compose logs -f docs
```

Open `http://localhost:4321`; guide edits reload automatically. The first start
installs dependencies in a Docker volume. After changing the docs lockfile, run
`docker compose exec docs npm ci` and restart the service.

To check the production build and search, run:

```bash
docker compose run --rm --no-deps -p 127.0.0.1:4322:4321 docs sh -c 'npm run build && npm run preview -- --host 0.0.0.0 --port 4321'
```

Open `http://localhost:4322`. Run this build in the temporary container, not the
running development container; they have separate generated content and caches.
After changing navigation, also check affected routes on the development site.
Node 24 users can alternatively run `npm --prefix docs ci` and the `docs/` package
scripts locally.

## Maintain Content and Navigation

Edit the source guides in `backend/`, `coding-standards/`, `frontend/`,
`local-development/`, and `workflows/`. Do not edit or commit the generated copies in
`src/content/docs/`. The sidebar follows the source directories and headings;
folder README files appear first, and other entries are alphabetical.

Number setup guides in execution order and use short title-case headings.

When moving or merging guides, update repository links and skill references,
preserve linked section IDs or update their callers, and run the repository link
check and docs build. Source paths define website URLs; do not add legacy redirects.

Production runbooks in `docs/production/` are local, ignored files and are excluded
from the public documentation site. Keep a private backup; new clones do not include them.

## Write and Maintain a Guide

- Keep each guide focused on its responsibility and link to other owners instead of repeating their rules.
- For procedures, give commands, location, prerequisites, expected results, verification, and relevant recovery.
- Keep testing boundaries in the testing guides and implementation details in source unless readers need them to act or decide.
- Use short rules, numbered actions, and concrete examples. Explain unfamiliar terms and remove repetition and filler.
- Use the site's Previous and Next links for sequential navigation.
- Update the owning guide when its contract or procedure changes.

See the [Starlight documentation](https://starlight.astro.build/) for site configuration.
