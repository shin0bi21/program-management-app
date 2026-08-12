# Backend API workflow

## Load architecture and patterns

1. Read `docs/architecture/backend.md` completely and the relevant architecture document for database, auth, errors, or HTTP behavior.
2. Read the applicable integration guide under `backend/docs/` and `docs/local/development.md` for migrations, Docker, dependency, or restart work.
3. Inspect two strong nearby backend domains before introducing a new API pattern.

## Preserve the API layers

- Follow `route + middleware → controller → service → PostgreSQL`.
- Compose protected middleware in order: authentication, permission, limiter, validation, then `asyncHandler(controller)`.
- Keep controllers thin: translate validated HTTP input/output only. Delegate business rules and persistence to services.
- Keep route capability checks permission-based and preserve the repository's `read:<resource>` / `write:<resource>` vocabulary unless the product explicitly defines another capability.
- Define Zod schemas for params, query, and body; keep transformed nullable/default values explicit and align inferred types with service inputs.
- Mount new routes in production and the shared test application. Update the API catalog when the public contract changes.
- Route HTTP calls through the established controller and service boundary instead of placing SQL or orchestration in controllers.

## Complete integrations

- Use `requireEnv()` for required configuration and escape user-controlled email HTML.
- Follow the relevant guide under `backend/docs/` for third-party or file-producing integrations.
- Keep provider, filesystem, email, and database failure boundaries explicit; do not report a durable write as failed merely because a later external delivery failed without an idempotent retry contract.
- After changing backend TypeScript, restart the backend before browser/manual verification; the local backend uses `ts-node` without a file watcher. Treat this as part of implementation, not a later troubleshooting step. Recreate it instead when environment changes require that according to `docs/local/development.md`.
