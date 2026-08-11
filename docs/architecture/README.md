# Architecture

The application is a React client backed by an Express API and PostgreSQL. In production, Nginx serves the frontend and proxies API traffic to Express; Docker Compose runs the application services.

```text
Browser / React
      │ HTTPS
      ▼
Nginx
      │ /api/*
      ▼
Express API ── postgres.js ── PostgreSQL
```

## Architecture map

| Area | Canonical document | Covers |
|---|---|---|
| HTTP lifecycle | [`http.mmd`](http.mmd) | Client transport, authentication and refresh, Express middleware, services, database calls, and response/error handling |
| Frontend | [`frontend.md`](frontend.md) | Ownership, dependency direction, data flow, state placement, and feature promotion |
| Backend | [`backend.md`](backend.md) | Layer ownership, dependency direction, middleware ordering, transactions, and domain structure |
| Authentication and authorization | [`auth.md`](auth.md) | JWTs, 2FA, refresh rotation, RBAC, revocation, and auth module boundaries |
| Database | [`database.md`](database.md) | Migrations, transactions, audit logging, auth logging, and base-table conventions |
| Error handling | [`errors.md`](errors.md) | Typed errors, middleware flow, response contracts, request tracing, and client errors |

This directory is the canonical home for architecture. Setup, development commands, deployment, API catalogs, and integration usage remain in their operational or subsystem documentation.

## Stable boundaries

- Frontend dependencies flow from `pages` to `common/features` to generic `common` code; root `app`, `auth`, `http`, and `query` directories own technical infrastructure.
- Frontend HTTP calls go through the centralized API client.
- Backend routes apply authentication, permissions, rate limiting, validation, and `asyncHandler` before thin controllers call services.
- Services own business logic and parameterized SQL. Nested writes join the caller's transaction.
- Database migrations are forward-only; applied migration files are never edited.
- Errors are thrown as typed errors and formatted by the global error handler.

Repository-wide implementation invariants are maintained in [`../../AGENTS.md`](../../AGENTS.md).
