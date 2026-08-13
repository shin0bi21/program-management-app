# Frontend

React + Vite frontend for the app.

## Documentation

| Area | Canonical document |
|---|---|
| Frontend architecture | [`../docs/architecture/frontend.md`](../docs/architecture/frontend.md) |
| Full HTTP lifecycle | [`../docs/architecture/http.mmd`](../docs/architecture/http.mmd) |
| Development handbook | [`../docs/development/README.md`](../docs/development/README.md) |
| Product features | [`../docs/features/README.md`](../docs/features/README.md) |
| Local setup | [`../docs/operations/setup.md`](../docs/operations/setup.md) |
| Local development and builds | [`../docs/operations/local-development.md`](../docs/operations/local-development.md) |
| Testing | [`../docs/operations/testing.md`](../docs/operations/testing.md) |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | API base URL — set in `frontend/.env.production` on the server as `VITE_API_URL=https://be-original.ca/api` |

Vite loads `frontend/.env.development` automatically for local development. Production configuration is provided by the uncommitted `frontend/.env.production` on the server.
