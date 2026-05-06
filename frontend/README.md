# Frontend

React + Vite frontend for the app.

## Quick Start
```
npm install
npm run dev
```

## Build
```
npm run build
```

## Structure
See `STRUCTURE.md` for the page‑scoped layout and conventions.

## Request / Response Flow
See [`docs/api-flow.mmd`](docs/api-flow.mmd) for the full frontend request lifecycle — `apiClient`, token validation, proactive refresh, re-login modal, network error handling, and response parsing.

For the full-stack overview (frontend → backend → DB), see the [root README](../README.md).

## Testing
Frontend unit tests are not yet configured. Backend integration tests (auth, staff, youth) are run via the shell scripts in [`../scripts/`](../scripts/) — e.g. `../scripts/run-auth-tests.sh`.

## Notes
- When adding new pages, keep API, hooks, and UI co‑located under `src/pages/<PageName>`.
