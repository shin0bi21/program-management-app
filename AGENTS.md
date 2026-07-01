# Codex Instructions

- Treat this repository as the workspace boundary.
- Do not read files outside this repository unless the user explicitly asks for that path or approves the access.
- Prefer repo-local instructions, skills, and configuration over global user-level Codex files.
- Do not inspect dependency directories such as `node_modules`.
- Respect `.gitignore`, `.openaiignore`, and `.codexignore` when searching or reading files.
- In this repo, when the user refers to the "full test suite," default to `scripts/test-full-stack.sh`.
- Script layout matters here:
  - `scripts/backend/` contains Docker-backed backend test runners, and `test-apis.sh` composes the individual backend suites.
  - `scripts/frontend/` contains frontend Vitest runners, and `test-ui.sh` composes the page/path-specific frontend suites.
  - `scripts/test-full-stack.sh` is the root cross-stack runner and executes backend first, then frontend.
- Be precise about test coverage:
  - `scripts/backend/test-apis.sh` runs backend API tests only.
  - `scripts/frontend/test-ui.sh` runs frontend UI tests only.
  - Some frontend path runners may skip cleanly when a page folder has no tests yet.
- Prefer the repo's feature-folder pattern for non-trivial frontend units: colocate UI, hook, schema/types, and tests inside the page component folder when the code is page-specific.
