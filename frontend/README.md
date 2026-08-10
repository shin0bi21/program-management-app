# Frontend

React + Vite frontend for the app.

## Documentation

| Area | Canonical document |
|---|---|
| Frontend architecture | [`../docs/architecture/frontend.md`](../docs/architecture/frontend.md) |
| Full HTTP lifecycle | [`../docs/architecture/http.mmd`](../docs/architecture/http.mmd) |
| Local setup | [`../docs/local/setup.md`](../docs/local/setup.md) |
| Local development and builds | [`../docs/local/development.md`](../docs/local/development.md) |
| Testing | [`../docs/testing.md`](../docs/testing.md) |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | API base URL — set in `frontend/.env.production` on the server as `VITE_API_URL=https://be-original.ca/api` |

Vite loads `frontend/.env.development` automatically for local development. Production configuration is provided by the uncommitted `frontend/.env.production` on the server.
