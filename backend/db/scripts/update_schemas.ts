#!/usr/bin/env node

/**
 * UPDATE SCHEMAS — PostgreSQL migration runner
 *
 * Applies the current init and ordered schema/data SQL migrations,
 * tracks them in the schema_migrations table, and regenerates TypeScript
 * types from the resulting schema.
 *
 * Flow (see main()):
 *   1. Validate arguments
 *   2. Acquire advisory lock        — apply mode only
 *   3. Read files and ledger        — build one shared migration plan
 *   4. Validate checksums           — dry-run reports the plan and stops here
 *   5. Apply each pending file      — atomic: migration + record in one tx
 *   6. Regenerate types             — only if every pending file succeeded
 *   7. Release lock + close conn    — always, via finally
 *
 * Usage:
 *   npx tsx db/scripts/update_schemas.ts                   # apply pending migrations
 *   npx tsx db/scripts/update_schemas.ts --dry-run          # read-only history/drift report
 *   npx tsx db/scripts/update_schemas.ts --dry-run --check  # fail on pending/drift
 */

// ============================================================================
// 1. Imports
// ============================================================================

import { execFileSync, execSync } from 'child_process';
import postgres from 'postgres';
import path from 'path';
import {
  calculateChecksum, listMigrationFiles, migrationFilePath, validateAppliedMigrations,
} from './helpers/read-migrations';

// ============================================================================
// 2. Config / constants
// ============================================================================

const DB_FILES_ROOT = process.env.MIGRATION_FILES_ROOT || path.join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const checkPending = process.argv.includes('--check');
const ADVISORY_LOCK_ID = 123456789; // arbitrary constant — same key across all runs

// ============================================================================
// 3. DB setup
// ============================================================================

/**
 * Creates the migration database client from DATABASE_URL; missing configuration prints an error and exits with status 1.
 * @example createDbClient().url // configured DATABASE_URL
 */
function createDbClient() {
  // 1. Reject missing connection configuration before opening the migration client.
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('ERROR: DATABASE_URL environment variable not set');
    process.exit(1);
  }
  // 2. Retain the connection URL for child migration and type-generation commands.
  return { sql: postgres(url), url: url as string };
}

const { sql, url: DB_URL } = createDbClient();

// ============================================================================
// 4. DB migration state helpers
// ============================================================================

interface MigrationRecord {
  version: string;
  applied_at: Date;
  checksum: string | null;
}

interface MigrationPlan {
  allFiles: string[];
  appliedMigrations: MigrationRecord[];
  pendingFiles: string[];
  drift: string[];
}

/**
 * Reads the ordered migration ledger; a missing pre-init ledger returns an empty list and other database errors propagate.
 * @example await getAppliedMigrations() // [] before the first init creates schema_migrations
 */
async function getAppliedMigrations(): Promise<MigrationRecord[]> {
  try {
    return await sql<MigrationRecord[]>`
      SELECT version, applied_at, checksum FROM schema_migrations ORDER BY applied_at, version
    `;
  } catch (error: unknown) {
    if ((error as { code?: string }).code === '42P01') return [];
    throw error;
  }
}

/**
 * Prints applied versions, pending filenames, and drift counts without modifying the database.
 * @example printMigrationPlan({ allFiles: [], appliedMigrations: [], pendingFiles: [], drift: [] }) // summary reports zero counts
 */
function printMigrationPlan(plan: MigrationPlan): void {
  // 1. List the ordered applied history with its recorded timestamps.
  console.log(`Applied migrations (${plan.appliedMigrations.length}):`);
  for (const record of plan.appliedMigrations) {
    console.log(`  ${record.version} (${new Date(record.applied_at).toISOString()})`);
  }

  // 2. List pending files and summarize pending and drift counts.
  console.log(`Pending migrations (${plan.pendingFiles.length}):`);
  for (const version of plan.pendingFiles) console.log(`  ${version}`);
  console.log(`Summary: ${plan.appliedMigrations.length} applied, ${plan.pendingFiles.length} pending, ${plan.drift.length} drift errors`);
}

// ============================================================================
// 5. Migration execution internals
// ============================================================================

interface MigrationContext {
  filename: string;
  filepath: string;
  checksum: string;
}

/**
 * Resolves a validated catalog filename and its current checksum; path and filesystem errors propagate.
 * @example buildMigrationContext('schema/init.sql').filename // 'schema/init.sql'
 */
function buildMigrationContext(filename: string): MigrationContext {
  const filepath = migrationFilePath(DB_FILES_ROOT, filename);
  const checksum = calculateChecksum(filepath);
  return { filename, filepath, checksum };
}

/**
 * Applies a validated SQL file and checksum ledger entry atomically through psql; reports failure and returns false on rollback.
 * @example executeMigration(context) // true when the file and ledger insert commit
 */
function executeMigration(ctx: MigrationContext): boolean {
  try {
    // 1. Build the ledger insert from the validated filename and checksum.
    // execFileSync (argv array, no shell) — DB_URL and filepath are not
    // interpreted as shell metacharacters. psql flags:
    //   -X                       ignore .psqlrc
    //   -v ON_ERROR_STOP=1       abort on first SQL error
    //   --single-transaction     wraps -f and -c in one BEGIN/COMMIT so the
    //                            migration SQL and its tracking INSERT are atomic
    //
    // Tracking INSERT values (filename + SHA-256 hex) are interpolated directly
    // into the SQL string — both are safe (filename validated, checksum is hex).
    // psql variable interpolation (:'var') is not used: psql 18 changed
    // how it handles -c mode and the interpolation no longer applies.
    // pg_dump init files clear search_path; qualify the ledger in that session.
    const trackingInsert =
      `INSERT INTO public.schema_migrations (version, name, checksum) VALUES ` +
      `('${ctx.filename}', '${ctx.filename}', '${ctx.checksum}') ` +
      `ON CONFLICT (version) DO NOTHING`;
    // 2. Apply the file and ledger insert in one PostgreSQL transaction.
    execFileSync('psql', [
      DB_URL,
      '-X',
      '-v', 'ON_ERROR_STOP=1',
      '--single-transaction',
      '-f', ctx.filepath,
      '-c', trackingInsert,
    ], { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`  Failed to apply ${ctx.filename}`);
    console.error(`  Changes were rolled back automatically (PostgreSQL transaction)`);
    console.error(error);
    return false;
  }
}

/**
 * Resolves and prints a migration filename and checksum before returning its atomic execution result.
 * @example await applyMigrationFile('schema/init.sql') // true after successful apply
 */
async function applyMigrationFile(filename: string): Promise<boolean> {
  // 1. Resolve the migration path and checksum before reporting the selected file.
  const ctx = buildMigrationContext(filename);
  console.log(`  Applying: ${ctx.filename}`);
  console.log(`  Checksum: ${ctx.checksum.slice(0, 12)}...`);
  // 2. Return the atomic execution result to the ordered apply loop.
  return executeMigration(ctx);
}

// ============================================================================
// 6. Runtime lifecycle
// ============================================================================

/**
 * Acquires a PostgreSQL session-level advisory lock.
 * pg_try_advisory_lock returns false immediately rather than blocking — so a
 * stale lock from a crashed run doesn't hang CI indefinitely.
 * @example await acquireMigrationLock() // returns with the session lock held, or rejects if another runner holds it
 */
async function acquireMigrationLock(): Promise<void> {
  // 1. Attempt the shared advisory lock without waiting for another runner.
  console.log(`Acquiring migration lock...`);
  const result = await sql<{ pg_try_advisory_lock: boolean }[]>`
    SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID})
  `;
  // 2. Reject concurrent migration work before reading or applying its plan.
  if (!result[0].pg_try_advisory_lock) {
    throw new Error(
      'Could not acquire migration lock — another migration process is already running. ' +
      'If no other process is running, release the lock manually:\n' +
      `  SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID});`,
    );
  }
  console.log(`Lock acquired\n`);
}

/**
 * Regenerates src/types/database.ts from the live schema via kysely-codegen; generator failures throw with retry instructions.
 * @example regenerateDatabaseTypes() // replaces generated database types after a successful apply
 */
function regenerateDatabaseTypes(): void {
  // 1. Generate types from the migrated schema using the current database connection.
  console.log('  Generating TypeScript types from database...');
  try {
    execSync('npx kysely-codegen --dialect postgres --date-parser string --out-file src/types/database.ts', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: DB_URL },
    });
  } catch (error) {
    // 2. Report generator failure without hiding that migrations already committed.
    console.error('  Failed to generate types');
    console.error(error);
    throw new Error('Type generation failed — run `npm run db:types` manually to retry.', { cause: error });
  }
}

/**
 * Releases an acquired advisory lock and closes the DB connection.
 * Called from finally; an unlock failure must not prevent connection shutdown.
 * Session-scoped locks also auto-release on connection close (belt-and-suspenders).
 * @param lockAcquired - Whether this run owns the session advisory lock.
 * @example await cleanup(false) // closes the client without issuing an unlock
 */
async function cleanup(lockAcquired: boolean): Promise<void> {
  // 1. Release only the advisory lock acquired by this run.
  if (lockAcquired) {
    try {
      await sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`;
    } catch {
      // Closing the connection below also releases the session advisory lock.
    }
  }

  // 2. Close the client even if explicit unlocking failed.
  await sql.end({ timeout: 5 });
}

// ============================================================================
// 7. Main workflow
// ============================================================================

interface ApplyResult {
  appliedFiles: string[];
  completed: boolean;
}

/**
 * Prints each drift finding and throws before apply when repository files differ from applied history.
 * @example validateMigrationHistory({ allFiles: [], appliedMigrations: [], pendingFiles: [], drift: [] }) // returns normally
 */
function validateMigrationHistory(plan: MigrationPlan): void {
  // 1. Report all checksum or missing-file differences.
  for (const error of plan.drift) console.warn(`WARNING: ${error}`);
  // 2. Abort before applying any files when applied history has drifted.
  if (plan.drift.length) {
    throw new Error('ABORTED: Applied migration history differs from the repository. Use the explicit collapse workflow when replacing an init.');
  }
}

/**
 * Reads the shared file catalog and database ledger to derive pending files and drift without applying migrations.
 * @example (await getMigrationPlan()).pendingFiles // unapplied catalog versions in execution order
 */
async function getMigrationPlan(): Promise<MigrationPlan> {
  // 1. Read the repository catalog and the database ledger.
  const allFiles = listMigrationFiles(DB_FILES_ROOT);
  const appliedMigrations = await getAppliedMigrations();
  // 2. Derive pending files and checksum drift from the same history boundary.
  const appliedVersions = new Set(appliedMigrations.map(record => record.version));
  const pendingFiles = allFiles.filter(file => !appliedVersions.has(file));
  const drift = validateAppliedMigrations(DB_FILES_ROOT, appliedMigrations);
  return { allFiles, appliedMigrations, pendingFiles, drift };
}

/**
 * Applies ordered pending filenames until the first failure, returning the committed subset and whether every file succeeded.
 * @example await applyPendingMigrations([]) // { appliedFiles: [], completed: true }
 */
async function applyPendingMigrations(pendingFiles: string[]): Promise<ApplyResult> {
  console.log(`\n------------------------------------------`);
  console.log(`Applying migrations...`);
  console.log(`------------------------------------------\n`);

  // 1. Apply pending files in catalog order and stop at the first failure.
  const appliedFiles: string[] = [];
  for (const file of pendingFiles) {
    const success = await applyMigrationFile(file);
    if (success) {
      appliedFiles.push(file);
      console.log(`  Applied: ${file}\n`);
    } else {
      console.log(`  Failed: ${file}`);
      console.log('\nStopping - please fix errors before continuing.\n');
      break;
    }
  }
  // 2. Report completion only when every requested file succeeded.
  return { appliedFiles, completed: appliedFiles.length === pendingFiles.length };
}

/**
 * Validates CLI mode, checks migration history, applies pending files, and generates nonproduction types; always cleans up its lock and connection.
 * @example // db:migrate -- --dry-run --check reports history and fails if files remain pending.
 */
async function main(): Promise<void> {
  let lockAcquired = false;

  console.log(`\n========================================`);
  console.log(dryRun ? 'UPDATE SCHEMAS (Dry run)' : 'UPDATE SCHEMAS (PostgreSQL-Native)');
  console.log(`========================================\n`);

  try {
    // 1. Validate argument combinations before acquiring the migration lock.
    const unknownArgument = process.argv.slice(2).find(argument => !['--dry-run', '--check'].includes(argument));
    if (unknownArgument) throw new Error(`Unknown argument: ${unknownArgument}`);
    if (checkPending && !dryRun) throw new Error('--check requires --dry-run');

    // 2. Serialize apply-mode work with the session advisory lock.
    if (!dryRun) {
      await acquireMigrationLock();
      lockAcquired = true;
    }

    // 3. Build one plan and validate applied checksums for both modes.
    const plan = await getMigrationPlan();
    if (dryRun) printMigrationPlan(plan);
    validateMigrationHistory(plan);

    // 4. Finish dry runs without executing SQL files or generating types.
    // Dry runs use the same plan and drift checks, with no lock, SQL execution,
    // ledger writes, or type generation. --check also rejects pending files.
    if (dryRun) {
      if (checkPending && plan.pendingFiles.length) process.exitCode = 1;
      return;
    }

    if (plan.pendingFiles.length === 0) {
      console.log(`Previously applied migrations: ${plan.appliedMigrations.length}`);
      console.log(`Total SQL files: ${plan.allFiles.length}`);
      console.log(`\nNo pending migrations to apply.\n`);
      return;
    }

    console.log(`Previously applied migrations: ${plan.appliedMigrations.length}`);
    console.log(`Total SQL files: ${plan.allFiles.length}`);
    console.log(`\nPending migrations: ${plan.pendingFiles.length}`);
    plan.pendingFiles.forEach(f => console.log(`  - ${f}`));

    // 5. Apply pending files atomically and reject partial completion.
    const result = await applyPendingMigrations(plan.pendingFiles);

    if (!result.completed) {
      console.log(`\nPartial apply (${result.appliedFiles.length}/${plan.pendingFiles.length}) — skipping type generation.`);
      console.log(`Fix the failing migration, then run db:migrate again.\n`);
      throw new Error(`Migration apply incomplete (${result.appliedFiles.length}/${plan.pendingFiles.length})`);
    }

    // 6. Regenerate types only after a complete nonproduction apply.
    if (process.env.NODE_ENV === 'production') {
      console.log(`\nSkipping type generation (production — types already compiled into dist/).`);
    } else {
      console.log(`\n------------------------------------------`);
      console.log(`Generating Types...`);
      console.log(`------------------------------------------\n`);
      regenerateDatabaseTypes();
    }

    console.log(`\n========================================`);
    console.log(`COMPLETE!`);
    console.log(`========================================\n`);
    console.log(`Applied ${result.appliedFiles.length} migration(s):`);
    result.appliedFiles.forEach(f => console.log(`  [APPLIED] ${f}`));
    console.log(``);
  } finally {
    // 7. Always release owned database resources.
    await cleanup(lockAcquired);
  }
}

// ============================================================================
// 8. Entrypoint
// ============================================================================

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
