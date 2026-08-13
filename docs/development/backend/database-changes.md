# Database changes

## Design the persistence contract

- Read `docs/architecture/database.md` completely before changing schema behavior.
- Encode stable invariants with foreign keys, unique and check constraints, required columns, indexes, and deletion behavior that preserves required history.
- Model current cardinality directly. A required single owner belongs on the parent as a non-null foreign key; use a relationship table only when zero/many relationships, independent relationship metadata, or relationship history is part of the current contract. A uniqueness constraint on a child row enforces at most one, not exactly one.
- Do not weaken current constraints for a hypothetical future workflow. If a future backlog, draft, or unassigned state has materially different required fields or lifecycle, model it deliberately when that workflow is approved.
- Use the repository base-table pattern for new data tables and add actor foreign keys consistently.
- Choose cascade, restrict, set-null, archive, or soft-delete behavior from the product's historical-record contract rather than convenience.

## Change migrations safely

- Never edit an applied or committed migration. Add a forward-only migration.
- While an uncommitted migration exists only in disposable local environments, fold feature corrections into it only when the user has confirmed no shared environment has applied it; reset disposable databases so checksums match.
- Treat renames and finite-value changes atomically across stored data, constraints, backend validation, response types, frontend contracts, preferences, seeds, and documentation.
- Keep unrelated operational concerns in separate migrations even when developed together.

## Synchronize and verify

- Regenerate `src/types/database.ts` through the migration workflow; do not hand-maintain a generated shape when the repository generator owns it.
- Update deterministic seeds and fixtures for new required relationships and fields.
- Apply migrations to fresh development and test databases, verify migration status and checksums, and query important constraints or migrated values directly.
- Follow [Local development](../../operations/local-development.md) for database resets, migration commands, and backend restarts.
