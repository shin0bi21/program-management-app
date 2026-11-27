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
 * See usage() for commands, modes, and prerequisites.
 */

import { execFileSync, execSync } from 'child_process';
import postgres from 'postgres';
import path from 'path';
import { requireEnv } from '../../src/utils/env';
import {
  calculateChecksum, listMigrationFiles, migrationFilePath, validateAppliedMigrations,
} from './helpers/read-migrations';

const DB_FILES_ROOT = process.env.MIGRATION_FILES_ROOT || path.join(__dirname, '..');

interface MigrationOptions {
  dryRun: boolean;
  checkPending: boolean;
  help: boolean;
}

// Stable session-lock key shared by every migration invocation.
const ADVISORY_LOCK_ID = 123456789;

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

interface MigrationContext {
  filename: string;
  filepath: string;
  checksum: string;
}

interface ApplyResult {
  appliedFiles: string[];
  completed: boolean;
}

/**
 * Validates CLI mode, checks migration history, applies pending files, and generates nonproduction types; always cleans up its lock and connection.
 * @example // db:migrate -- --dry-run --check reports history and fails if files remain pending.
 */
async function main(): Promise<void> {
  // 1. Validate options and handle help before creating the migration client.
  const { dryRun, checkPending, help } = parseArgs(process.argv.slice(2));
  if (help) {
    console.log(usage());
    return;
  }

  const { sql, url } = createDbClient();
  let lockAcquired = false;

  console.log(`\n========================================`);
  console.log(dryRun ? 'UPDATE SCHEMAS (Dry run)' : 'UPDATE SCHEMAS (PostgreSQL-Native)');
  console.log(`========================================\n`);

  try {
    // 2. Serialize apply-mode work with the session advisory lock.
    if (!dryRun) {
      await acquireMigrationLock(sql);
      lockAcquired = true;
    }

    // 3. Build one plan and validate applied checksums for both modes.
    const plan = await getMigrationPlan(sql);
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
    const result = await applyPendingMigrations(plan.pendingFiles, url);

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
      regenerateDatabaseTypes(url);
    }

    console.log(`\n========================================`);
    console.log(`COMPLETE!`);
    console.log(`========================================\n`);
    console.log(`Applied ${result.appliedFiles.length} migration(s):`);
    result.appliedFiles.forEach(f => console.log(`  [APPLIED] ${f}`));
    console.log(``);
  } finally {
    // 7. Always release owned database resources.
    await cleanup(sql, lockAcquired);
  }
}

/**
 * Validates migration modes before configuration or database access.
 * @example parseArgs(['--dry-run', '--check']).checkPending // true
 */
function parseArgs(args: string[]): MigrationOptions {
  const unknownArgument = args.find(argument => !['--dry-run', '--check', '-h', '--help'].includes(argument));
  if (unknownArgument) throw new Error(`Unknown argument: ${unknownArgument}`);

  const dryRun = args.includes('--dry-run');
  const checkPending = args.includes('--check');
  if (checkPending && !dryRun) throw new Error('--check requires --dry-run');

  return { dryRun, checkPending, help: args.includes('-h') || args.includes('--help') };
}

/**
 * Supplies migration modes and resource requirements without accessing the database.
 * @example usage().includes('--dry-run') // true
 */
function usage(): string {
  return `Usage: npm run db:migrate -- [--dry-run [--check]]

  --dry-run   Report applied/pending files and drift without applying migrations.
  --check     Fail when files are pending; requires --dry-run.
  -h, --help  Show help without database access.

Requires DATABASE_URL. Apply mode requires psql and acquires an advisory lock.
Successful nonproduction applies regenerate database types; production skips generation.`;
}

/**
 * Creates the migration database client from DATABASE_URL; missing configuration throws before client creation.
 * @example createDbClient().url // configured DATABASE_URL
 */
function createDbClient() {
  // 1. Reject missing connection configuration before opening the migration client.
  const url = requireEnv('DATABASE_URL');

  // 2. Retain the connection URL for child migration and type-generation commands.
  return { sql: postgres(url), url };
}

/**
 * Acquires a PostgreSQL session-level advisory lock.
 * pg_try_advisory_lock returns false immediately rather than blocking — so a
 * stale lock from a crashed run doesn't hang CI indefinitely.
 * @param sql - Migration client that owns the lock until cleanup.
 * @example await acquireMigrationLock(sql) // returns with the session lock held, or rejects if another runner holds it
 */
async function acquireMigrationLock(sql: postgres.Sql): Promise<void> {
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
 * Reads the shared file catalog and database ledger to derive pending files and drift without applying migrations.
 * @param sql - Migration client used to read applied history.
 * @example (await getMigrationPlan(sql)).pendingFiles // unapplied catalog versions in execution order
 */
async function getMigrationPlan(sql: postgres.Sql): Promise<MigrationPlan> {
  // 1. Read the repository catalog and the database ledger.
  const allFiles = listMigrationFiles(DB_FILES_ROOT);
  const appliedMigrations = await getAppliedMigrations(sql);
  // 2. Derive pending files and checksum drift from the same history boundary.
  const appliedVersions = new Set(appliedMigrations.map(record => record.version));
  const pendingFiles = allFiles.filter(file => !appliedVersions.has(file));
  const drift = validateAppliedMigrations(DB_FILES_ROOT, appliedMigrations);
  return { allFiles, appliedMigrations, pendingFiles, drift };
}

/**
 * Reads the ordered migration ledger; a missing pre-init ledger returns an empty list and other database errors propagate.
 * @param sql - Migration client connected to the selected database.
 * @example await getAppliedMigrations(sql) // [] before the first init creates schema_migrations
 */
async function getAppliedMigrations(sql: postgres.Sql): Promise<MigrationRecord[]> {
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
 * Applies ordered pending filenames until the first failure, returning the committed subset and whether every file succeeded.
 * @param databaseUrl - Target connection used by each atomic psql invocation.
 * @example await applyPendingMigrations([], databaseUrl) // { appliedFiles: [], completed: true }
 */
async function applyPendingMigrations(pendingFiles: string[], databaseUrl: string): Promise<ApplyResult> {
  console.log(`\n------------------------------------------`);
  console.log(`Applying migrations...`);
  console.log(`------------------------------------------\n`);

  // 1. Apply pending files in catalog order and stop at the first failure.
  const appliedFiles: string[] = [];
  for (const file of pendingFiles) {
    const success = await applyMigrationFile(file, databaseUrl);
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
 * Resolves and prints a migration filename and checksum before returning its atomic execution result.
 * @param databaseUrl - Target connection passed to the atomic psql invocation.
 * @example await applyMigrationFile('schema/init.sql', databaseUrl) // true after successful apply
 */
async function applyMigrationFile(filename: string, databaseUrl: string): Promise<boolean> {
  // 1. Resolve the migration path and checksum before reporting the selected file.
  const ctx = buildMigrationContext(filename);
  console.log(`  Applying: ${ctx.filename}`);
  console.log(`  Checksum: ${ctx.checksum.slice(0, 12)}...`);
  // 2. Return the atomic execution result to the ordered apply loop.
  return executeMigration(ctx, databaseUrl);
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
 * @param databaseUrl - Target connection passed directly to psql without a shell.
 * @example executeMigration(context, databaseUrl) // true when the file and ledger insert commit
 */
function executeMigration(ctx: MigrationContext, databaseUrl: string): boolean {
  try {
    // 1. Build the ledger insert from the validated filename and checksum.
    // execFileSync (argv array, no shell) — databaseUrl and filepath are not
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
      databaseUrl,
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
 * Regenerates src/types/database.ts from the live schema via kysely-codegen; generator failures throw with retry instructions.
 * @param databaseUrl - Migrated database supplied to the generator environment.
 * @example regenerateDatabaseTypes(databaseUrl) // replaces generated database types after a successful apply
 */
function regenerateDatabaseTypes(databaseUrl: string): void {
  // 1. Generate types from the migrated schema using the current database connection.
  console.log('  Generating TypeScript types from database...');
  try {
    execSync('npx kysely-codegen --dialect postgres --date-parser string --out-file src/types/database.ts', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
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
 * @param sql - Owned migration client to unlock and close.
 * @example await cleanup(sql, false) // closes the client without issuing an unlock
 */
async function cleanup(sql: postgres.Sql, lockAcquired: boolean): Promise<void> {
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

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exitCode = 1;
  });
}
