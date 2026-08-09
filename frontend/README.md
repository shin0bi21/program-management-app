# Frontend

React + Vite frontend for the app.

## Local Development

The supported full-stack workflow runs through Docker Compose from the
repository root:

- [First-time local environment setup](../docs/local-setup.md)
- [Day-to-day local development commands](../docs/local-development.md)

Direct `npm` commands are still useful inside the frontend container; see the
command guide for dependency, test, restart, and rebuild instructions.

## Build
```
npm run build
```

## Structure
See `STRUCTURE.md` for the page‑scoped layout and conventions.

The homepage now follows section-level feature folders under `src/pages/Homepage/components/`, with section-specific hooks and tests colocated next to each section.

## Request / Response Flow
See [`../docs/architecture/request-flow.mmd`](../docs/architecture/request-flow.mmd) for the full request lifecycle — `apiClient`, token validation, proactive refresh, re-login modal, backend middleware, and response parsing.

For the full-stack overview (frontend → backend → DB), see the [root README](../README.md).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | API base URL — set in `frontend/.env.production` on the server as `VITE_API_URL=https://be-original.ca/api` |

## Testing
Frontend tests are configured with Vitest.

- Full frontend suite: [`../scripts/frontend/test-ui.sh`](../scripts/frontend/test-ui.sh)
- Path-based frontend runners: [`../scripts/frontend/`](../scripts/frontend/) such as `run-homepage-tests.sh`, `run-youth-tests.sh`, and `run-common-tests.sh`
- Direct Vitest run inside `frontend/`: `npm test`

The frontend umbrella runner composes the path-based runners and will skip page folders that do not have tests yet. Backend integration tests (auth, staff, youth, schools) are run separately via [`../scripts/backend/`](../scripts/backend/) — for example `run-auth-tests.sh` and `test-apis.sh`.

## Notes
- When adding new pages, keep API, hooks, and UI co‑located under `src/pages/<PageName>`.
