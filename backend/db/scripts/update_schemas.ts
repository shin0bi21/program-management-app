#!/usr/bin/env node

/**
 * UPDATE SCHEMAS — PostgreSQL migration runner
 *
 * Applies pending SQL migrations from db/migrations/ in alphabetical order,
 * tracks them in the schema_migrations table, and regenerates TypeScript
 * types from the resulting schema.
 *
 * Flow (see main()):
 *   1. Acquire advisory lock        — prevents concurrent runs
 *   2. Validate checksums           — detects tampered/missing applied files
 *   3. Diff disk vs. DB             — find pending migrations
 *   4. Apply each pending file      — atomic: migration + record in one tx
 *   5. Regenerate types             — only if every pending file succeeded
 *   6. Release lock + close conn    — always, via finally
 *
 * Usage:
 *   npx tsx db/scripts/update_schemas.ts              # apply pending migrations
 *   npx tsx db/scripts/update_schemas.ts --no-strict  # warn (not abort) on checksum drift
 */

// ============================================================================
// 1. Imports
// ============================================================================

import { execFileSync, execSync } from 'child_process';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ============================================================================
// 2. Config / constants
// ============================================================================

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const ADVISORY_LOCK_ID = 123456789; // arbitrary constant — same key across all runs

// ============================================================================
// 3. CLI parsing
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    abortOnDrift: !args.includes('--no-strict'),
  };
}

const { abortOnDrift } = parseArgs();

// ============================================================================
// 4. DB setup
// ============================================================================

function createDbClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('ERROR: DATABASE_URL environment variable not set');
    process.exit(1);
  }
  return { sql: postgres(url), url: url as string };
}

const { sql, url: DB_URL } = createDbClient();

// ============================================================================
// 5. Migration file helpers
// ============================================================================

/** SHA-256 of a file's bytes — used to detect post-apply tampering. */
function calculateChecksum(filepath: string): string {
  const content = fs.readFileSync(filepath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * All *.sql files in MIGRATIONS_DIR, sorted alphabetically (apply order).
 * Validates that filenames are safe to pass as psql -v values.
 */
function getMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Filenames are passed to psql as -v variable values.
  // `=` breaks psql's key=value split; whitespace splits the argv token.
  for (const f of files) {
    if (/[=\s]/.test(f)) {
      throw new Error(`Migration filename cannot contain '=' or whitespace: ${f}`);
    }
  }
  return files;
}

// ============================================================================
// 6. DB migration state helpers
// ============================================================================

/**
 * Returns versions of all migrations recorded in schema_migrations.
 * Returns [] if the table doesn't exist yet (first run, before init migration).
 */
async function getAppliedMigrations(): Promise<string[]> {
  try {
    const result = await sql<{ version: string }[]>`
      SELECT version FROM schema_migrations ORDER BY applied_at
    `;
    return result.map(r => r.version);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('relation "schema_migrations" does not exist')) {
      return []; // first run — init migration will create the table
    }
    throw error;
  }
}

/**
 * For every applied migration in the DB, verifies the file on disk still
 * exists and its checksum still matches.
 *
 * Returns true if any drift is detected. Caller decides whether that's fatal
 * (abortOnDrift, the default) or just a warning (--no-strict).
 */
async function detectChecksumDrift(): Promise<boolean> {
  let driftFound = false;
  try {
    const applied = await sql<{ version: string; checksum: string | null }[]>`
      SELECT version, checksum FROM schema_migrations WHERE checksum IS NOT NULL
    `;

    for (const row of applied) {
      const filepath = path.join(MIGRATIONS_DIR, row.version);
      if (!fs.existsSync(filepath)) {
        console.warn(`WARNING: ${row.version} was applied but file no longer exists on disk!`);
        driftFound = true;
        continue;
      }
      const currentChecksum = calculateChecksum(filepath);
      if (currentChecksum !== row.checksum) {
        console.warn(`WARNING: ${row.version} was modified after being applied!`);
        console.warn(`   Expected: ${row.checksum?.slice(0, 12)}...`);
        console.warn(`   Current:  ${currentChecksum.slice(0, 12)}...`);
        driftFound = true;
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('relation "schema_migrations" does not exist')) {
      throw error; // first-run case is fine; everything else propagates
    }
  }
  return driftFound;
}

// ============================================================================
// 7. Migration execution internals
// ============================================================================

interface MigrationContext {
  filename: string;
  filepath: string;
  checksum: string;
}

function buildMigrationContext(filename: string): MigrationContext {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const checksum = calculateChecksum(filepath);
  return { filename, filepath, checksum };
}

function executeMigration(ctx: MigrationContext): boolean {
  try {
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
    const trackingInsert =
      `INSERT INTO schema_migrations (version, name, checksum) VALUES ` +
      `('${ctx.filename}', '${ctx.filename}', '${ctx.checksum}') ` +
      `ON CONFLICT (version) DO NOTHING`;
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

async function applyMigrationFile(filename: string): Promise<boolean> {
  const ctx = buildMigrationContext(filename);
  console.log(`  Applying: ${ctx.filename}`);
  console.log(`  Checksum: ${ctx.checksum.slice(0, 12)}...`);
  return executeMigration(ctx);
}

// ============================================================================
// 8. Runtime lifecycle
// ============================================================================

/**
 * Acquires a PostgreSQL session-level advisory lock.
 * pg_try_advisory_lock returns false immediately rather than blocking — so a
 * stale lock from a crashed run doesn't hang CI indefinitely.
 */
async function acquireMigrationLock(): Promise<void> {
  console.log(`Acquiring migration lock...`);
  const result = await sql<{ pg_try_advisory_lock: boolean }[]>`
    SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID})
  `;
  if (!result[0].pg_try_advisory_lock) {
    throw new Error(
      'Could not acquire migration lock — another migration process is already running. ' +
      'If no other process is running, release the lock manually:\n' +
      `  SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID});`,
    );
  }
  console.log(`Lock acquired\n`);
}

/** Regenerates src/types/database.ts from the live schema via kysely-codegen. */
function regenerateDatabaseTypes(): void {
  console.log('  Generating TypeScript types from database...');
  try {
    execSync('npx kysely-codegen --dialect postgres --out-file src/types/database.ts', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: DB_URL },
    });
  } catch (error) {
    console.error('  Failed to generate types');
    console.error(error);
    throw new Error('Type generation failed — run `npm run db:types` manually to retry.');
  }
}

/**
 * Releases the advisory lock and closes the DB connection.
 * Always called from the finally block — must not throw or mask prior errors.
 * Session-scoped locks also auto-release on connection close (belt-and-suspenders).
 */
async function cleanup(): Promise<void> {
  try {
    await sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`;
  } catch {}
  await sql.end({ timeout: 5 });
}

// ============================================================================
// 9. Main workflow
// ============================================================================

interface MigrationPlan {
  allFiles: string[];
  appliedMigrations: string[];
  pendingFiles: string[];
}

interface ApplyResult {
  appliedFiles: string[];
  completed: boolean;
}

async function validateMigrationHistory(): Promise<void> {
  const driftFound = await detectChecksumDrift();
  if (driftFound && abortOnDrift) {
    throw new Error('ABORTED: Migration file(s) were modified after being applied. To bypass (not recommended): add --no-strict flag');
  }
}

async function getMigrationPlan(): Promise<MigrationPlan> {
  const allFiles = getMigrationFiles();
  const appliedMigrations = await getAppliedMigrations();
  const pendingFiles = allFiles.filter(f => !appliedMigrations.includes(f));
  return { allFiles, appliedMigrations, pendingFiles };
}

async function applyPendingMigrations(pendingFiles: string[]): Promise<ApplyResult> {
  console.log(`\n------------------------------------------`);
  console.log(`Applying migrations...`);
  console.log(`------------------------------------------\n`);

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
  return { appliedFiles, completed: appliedFiles.length === pendingFiles.length };
}

async function main(): Promise<void> {
  console.log(`\n========================================`);
  console.log(`UPDATE SCHEMAS (PostgreSQL-Native)`);
  console.log(`========================================\n`);

  try {
    await acquireMigrationLock();

    await validateMigrationHistory();

    const plan = await getMigrationPlan();

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

    const result = await applyPendingMigrations(plan.pendingFiles);

    if (!result.completed) {
      console.log(`\nPartial apply (${result.appliedFiles.length}/${plan.pendingFiles.length}) — skipping type generation.`);
      console.log(`Fix the failing migration, then run db:migrate again.\n`);
      return;
    }

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
    await cleanup();
  }
}

// ============================================================================
// 10. Entrypoint
// ============================================================================

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

