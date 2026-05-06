# Youth Services Application

Full-stack youth services management system — React + TypeScript frontend, Express + TypeScript backend, PostgreSQL.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | Express 4, TypeScript, postgres.js |
| Database | PostgreSQL |
| Auth | JWT access token (1h) + refresh token (8h httpOnly cookie) + 2FA via email |

---

## Full-Stack Request / Response Flow

Every user action in the browser becomes an HTTP request to the backend API. The backend validates the JWT, runs business logic, queries the database, and returns JSON.

```mermaid
flowchart TD
    A([Browser\nUI action]) --> B[Frontend\napi module]
    B -->|HTTP request| C[Express backend]

    C --> RL{Rate limiter\nrateLimiter.ts}
    RL -->|"429 Too many requests"| B
    RL -->|Pass| CORS{CORS check}
    CORS -->|"Blocked — origin not allowed"| B
    CORS -->|Pass| MATCH{Route match?}
    MATCH -->|No| NF[sendError 404\nNot found]
    NF --> B

    MATCH -->|Yes| VAL{validateRequest\nZod schema\nvalidateRequest.ts}
    VAL -->|"400 Validation failed\n{ details: [{ field, message }] }"| B
    VAL -->|Pass| AUTH{Auth required?}

    AUTH -->|No| CTRL[Route controller]
    AUTH -->|Yes| MW[authMiddleware\nverifies JWT · checks blacklist\nauthMiddleware.ts]
    MW -->|"401 No token / invalid / expired"| B
    MW -->|Valid| CTRL

    CTRL --> SVC[Service layer]
    SVC -->|SQL query| DB[(PostgreSQL)]
    DB -->|Result rows| SVC
    DB -->|Connection failure| ERR
    SVC -->|throws AppError\ne.g. 404 · 409 · 403| ERR[errorHandler\nerrorHandler.ts]
    SVC -->|Result| CTRL
    CTRL -->|"200 JSON { data }"| B

    ERR -->|"4xx JSON { error, requestId }"| B
    ERR -->|"500 unexpected error"| B
    ERR -->|"503 DB unavailable"| B

    B --> UI([Update UI\nor render error])
```

> For the **frontend** request lifecycle — `apiClient`, token validation, proactive refresh, re-login modal, network error handling — see [frontend/docs/api-flow.mmd](frontend/docs/api-flow.mmd).
>
> For the **backend** in detail:
> - Auth (login, 2FA, token types, refresh rotation, logout) — [backend/docs/auth.md](backend/docs/auth.md)
> - Error handling (AppError, errorHandler, DB → 503) — [backend/docs/errors.md](backend/docs/errors.md)
> - Database schema & migrations — [backend/docs/db.md](backend/docs/db.md)

---

## Sub-docs

| Area | Doc |
|---|---|
| Frontend request/response lifecycle | [frontend/docs/api-flow.mmd](frontend/docs/api-flow.mmd) |
| Frontend page structure & conventions | [frontend/STRUCTURE.md](frontend/STRUCTURE.md) |
| Backend auth architecture | [backend/docs/auth.md](backend/docs/auth.md) |
| Backend database schema | [backend/docs/db.md](backend/docs/db.md) |
| Backend error handling | [backend/docs/errors.md](backend/docs/errors.md) |

---

## Quick Start

See [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md) for setup instructions.
