# Documentation Maintenance

This directory contains both the canonical developer guides and a standalone
Starlight website. This README is a repository-only maintenance guide and is not
published in the handbook. The application continues to build and deploy only its frontend
and backend; documentation hosting has no application role, database, or runtime
dependency on AWS.

## Local Use

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
docker compose run --rm --no-deps -p 127.0.0.1:4322:4321 docs sh -c 'npm run build && npm run preview -- --host 0.0.0.0 --port 4321'
```

Starlight's Pagefind search is generated during the production build; test search
at `http://localhost:4322`. Local development and preview do not provide authentication;
Docker publishes these ports on localhost only. Alternatively, Node 24 users can
run `npm ci` and the `dev`, `build`, and `preview` scripts directly in `docs/`.

Run build validation in the temporary container above, rather than inside the
running dev container: each container has its own generated content and Astro
cache. After reorganizing pages or navigation, verify the affected routes on the
running development site as well as the static build.

## Website Support

`site/` contains the modules used by `astro.config.ts`:

- `sidebar.ts` defines sidebar groups, labels, and guide order.
- `generate-content.ts` converts canonical guides into Starlight pages.
- `convert-markdown-links.ts` translates guide links into website routes or GitHub links.

These modules support the documentation website during development and builds.
The docs package has no separate test suite or post-build checker; `npm run build`
builds the website and its search index. Content generation still rejects missing
sidebar entries and invalid repository links.

## Content Ownership

Edit the existing files in `backend/`, `frontend/`, and `workflows/`. The repository
root README provides the site's overview; this file owns maintenance instructions.
Build tooling derives Starlight content in ignored `src/content/docs/`, adding
titles and translating repository links into website routes. Never edit or commit
those generated copies. Page titles preserve the authored heading, including casing.

The [sidebar configuration](site/sidebar.ts) groups guides by reader task. Workflow
folders separate local development, delivery, and production recovery; each has
a short entry page. For onboarding, give each substantial stage its own page,
explain prerequisites and expected results, and link to the next step. Keep
day-to-day operations separate from first-time setup. Add every published guide to
that map exactly once; generation rejects missing, duplicate, and unknown entries.
Use title case for page titles, section headings, and sidebar labels; preserve
acronyms, product names, and inline code. Keep labels brief. Add an index for an independently useful
area, not for every navigation subgroup or procedural step.

When merging or moving a guide, update repository links and skill references in the
same change. Add its former website route to `redirects` in
[the site configuration](astro.config.ts), pointing to the relevant section where
appropriate. Preserve linked section IDs or update their callers; a page redirect
alone does not repair a renamed heading. Run the repository link check and the docs build after changing links or routes.

The website preserves code blocks and tables. Mermaid diagrams are currently
shown as source code. Source-file links open the private GitHub repository and
require repository access. `DOCS_GIT_REF` controls the GitHub ref used for those
links; it defaults to `main`.

Only the repository root README and the three documentation areas are included.
Environment files, application source, dependencies, and agent
instructions are not copied into the site.

## Write and Maintain a Guide

- Keep each guide focused on its assigned responsibility and place in the sequence.
- Process guides contain actions, exact commands, expected results, and necessary recovery. Omit repeated setup prerequisites, ownership reminders, and narration of script internals.
- Link to other owners for their rules; do not repeat their content or expand into their tasks.
- Keep testing boundaries and framework guidance in the testing guides. Component and file guides describe implementation contracts, not suite inventories or coverage assignments. Do not add routine reminders to consult Testing; keep its discovery links in documentation navigation.
- Prefer short rules, numbered actions, and concrete examples. Use paragraphs only when explanation is necessary.
- Choose clarity over brevity, but remove repetition, obvious instructions, filler, and unnecessary introductions.
- Speak directly to the reader. Explain unfamiliar terms when needed.
- For commands, identify the location, prerequisites, expected result, and verification; include recovery when relevant.
- Use the site's Previous and Next links for sequential navigation.
- Keep implementation details in source and tests unless readers need them to act or decide.
- Update the owning guide when its contract or procedure changes.

## Further Reading

- [Starlight documentation](https://starlight.astro.build/)
