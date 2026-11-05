# Database and Migrations

## Create a Migration

1. Add structural SQL under `backend/db/schema/migrations/` or seed/backfill SQL under `backend/db/data/migrations/`, named `YYYY-MM-DD_#_description.sql`. Use the date written, an integer starting at 1 for that date, and a short snake_case description. Filenames must be unique across both folders; all files run in one lexicographic order. Existing `backend/db/migrations/` history remains supported until the first explicit collapse.
2. Encode the persistence contract and use the base-table pattern below for new data tables.
3. Update seeds and fixtures for required fields and relationships.
4. Apply the migration and regenerate database types using the [local migration commands](../workflows/local-development/README.md#migrations-and-database-types).
5. Verify status and checksums, exercise the migration on a fresh test database, and query important constraints or migrated values directly.

`db:migrate` regenerates `backend/src/types/database.ts`. If generation fails after migration succeeds, retry `db:types` using the local development workflow.

### Keep Migration History Immutable

Once a migration is committed or applied to a shared environment, never edit or rename it. Add a forward migration instead. The explicit [database collapse workflow](../workflows/delivery/collapse-database.md) is the sole exception for retiring history: it exports the current PostgreSQL state, verifies a replacement database with the same data, and replaces the ledger and covered files only after a successful switch. Uncommitted migrations used only in confirmed-disposable local databases may be folded before shipping; reset every affected database to match the final checksums. Keep independently shippable concerns in separate migrations.

The runner applies each file and its tracking record in one transaction. A failed file rolls back; previously applied files remain committed. An advisory lock prevents parallel migration runs, and strict checksum validation rejects changed or missing applied files. The runner does not automatically clear or adopt history. Use `db:migrate -- --dry-run` to inspect the same plan without applying it, and add `--check` for a nonzero exit on pending files. Drift always fails validation. `db:status` remains an alias for dry-run mode. Runner details live in [update_schemas.ts](../../backend/db/scripts/update_schemas.ts).

The schema runner, collapse workflow, and migration immutability check use the same
[migration catalog](../../backend/db/scripts/helpers/read-migrations.ts) for file discovery,
safe paths, baseline checksums, and shared schema/data ordering. Keep those rules
in the catalog so maintenance commands cannot accept a different history.

## Create a Data Table

Every new data table uses `LIKE base_table INCLUDING ALL` for audit columns and their defaults. Define `id` explicitly first; it is not part of `base_table`. Do not redefine `created_at`, `updated_at`, `created_by`, or `updated_by`.

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  LIKE base_table INCLUDING ALL,
  title TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_posts_user_id ON posts(user_id);
```

Choose deletion behavior for the actual domain; cascading is appropriate only when dependent history may be removed. Services set `updated_at = NOW()` on every update because there is no automatic update trigger.

## Persistence Design Contract

- Encode current invariants with foreign keys, unique and check constraints, required columns, indexes, and deliberate deletion behavior.
- Model current cardinality directly. A required single owner belongs on the parent as a non-null foreign key; use a relationship table only when zero/many relationships, independent relationship metadata, or relationship history is part of the current contract. A uniqueness constraint on a child row enforces at most one, not exactly one.
- Do not weaken current constraints for a hypothetical future workflow. Model a materially different backlog, draft, or unassigned lifecycle only when that workflow is approved.
- Choose cascade, restrict, set-null, archive, or soft-delete behavior from the product's historical-record contract rather than convenience.

## Update Enumerated Fields

An enumerated application field has one contract spread across the database constraint, backend validation and labels, frontend types and options, tests, and seeds. Update all of those owners together; changing only the displayed label leaves an obsolete value in the API and database.

### Text Columns Constrained with `CHECK`

Most finite-value fields in this repository use `TEXT` plus a named `CHECK` constraint. Rename a value in one atomic forward migration by temporarily removing the constraint, migrating stored rows, and recreating the complete constraint:

```sql
ALTER TABLE time_entries DROP CONSTRAINT time_entries_category_check;

UPDATE time_entries
SET category = 'outreach'
WHERE category = 'promotion';

ALTER TABLE time_entries
  ADD CONSTRAINT time_entries_category_check
  CHECK (category IN ('program_delivery', 'planning_prep', 'outreach'));
```

Do not support both spellings merely to avoid migrating data. After the migration, backend validation and frontend types should accept only the new value. Verify the actual constraint name in the defining migration or PostgreSQL catalog rather than guessing it.

### Native PostgreSQL Enum Types

For a true PostgreSQL enum value rename, use PostgreSQL's native operation; existing rows are updated by the type itself:

```sql
ALTER TYPE attendance_status RENAME VALUE 'old_value' TO 'new_value';
```

Adding or removing native enum values has different PostgreSQL semantics. Confirm the deployed PostgreSQL version and write a forward migration appropriate to that operation instead of rebuilding a type casually.

### Required Application Updates

In the same change, search for both the stored value and its user-facing label, then update:

- backend request schemas and typed service mappings.
- frontend unions, options, filters, and labels.
- API and UI tests.
- deterministic seed scripts and fixtures.
- integration documentation when the value crosses an external boundary.

Run the migration against a fresh test database, regenerate `backend/src/types/database.ts`, run affected backend and frontend tests, and query the database to confirm the old value no longer exists.

## Record Audited Changes

Auditing is explicit: adding a write service does not automatically record its changes. Call [auditService.ts](../../backend/src/services/shared/auditService.ts) inside the mutation's transaction so data and audit rows commit or roll back together.

```ts
await audit(trx, userId, transactionId, 'youth_profiles', profileId, 'UPDATE', oldRow, newRow);
```

Generate one `transactionId` per save operation and pass it through nested writes to group their audit rows. Store before/after snapshots and relationship IDs needed to understand or undo the change. Inserts have no old snapshot; deletes have no new snapshot.

Follow [service transaction ownership](services.md#keep-writes-safe) when composing writes. Security events use the separate [auth log](auth.md#record-auth-events), whose failures do not roll back authentication.

### Historical Snapshots

Audit snapshots preserve the schema at the time of the event. Older Lead and
Youth rows may contain retired `age`, `gradeLevel`, or `ageGroup` fields. Do not
rewrite those audit rows or transaction IDs, or replay retired fields into live
tables. Historical age must use DOB and the event date, not today's date;
birthdays do not themselves generate audit events. DOB backfills and column
removals are recorded in migration history without per-record audit entries.
