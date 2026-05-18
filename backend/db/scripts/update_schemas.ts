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
 *   npx tsx db/scripts/update_schemas.ts --dry-run    # preview, no changes
 *   npx tsx db/scripts/update_schemas.ts --no-strict  # warn (not abort) on checksum drift
 */

import { execFileSync, execSync } from 'child_process';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const ADVISORY_LOCK_ID = 123456789; // arbitrary constant — same key across all runs

// Require DATABASE_URL at startup. TS doesn't carry this narrowing into
// functions defined below, so we re-bind to DB_URL: string for callsites.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}
const DB_URL: string = DATABASE_URL;
const sql = postgres(DB_URL);

// CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d');
const isStrict = !args.includes('--no-strict'); // strict by default — abort on checksum drift

// ============================================================================
// Filesystem + DB queries
// ============================================================================

/**
 * Returns versions of all migrations recorded in schema_migrations.
 * Returns [] if the table doesn't exist yet (first run, before init migration).
 *
 * Ordered by applied_at (insertion order), which may differ from alphabetical
 * order if migrations were ever applied out of sequence. That's fine —
 * downstream callers only use this for set-membership checks (.includes()).
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
    throw error; // any other DB error is real and should surface
  }
}

/** SHA-256 of a file's bytes — used to detect post-apply tampering. */
function calculateChecksum(filepath: string): string {
  const content = fs.readFileSync(filepath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** All *.sql files in MIGRATIONS_DIR, sorted alphabetically (apply order). */
function getSQLFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
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
// Migration execution
// ============================================================================

/**
 * Applies one migration file atomically with its schema_migrations record.
 *
 * Both the migration SQL (-f) and the tracking INSERT (-c) run inside a single
 * psql --single-transaction. Either both commit or both roll back — there is
 * no window where a migration applies without being recorded.
 *
 * Returns false (does not throw) so the caller can stop the loop and surface
 * a clean error summary rather than a stack trace.
 */
async function applySQLFile(filename: string): Promise<boolean> {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const checksum = calculateChecksum(filepath);

  console.log(`  Applying: ${filename}`);
  console.log(`  Checksum: ${checksum.slice(0, 12)}...`);

  if (isDryRun) {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('--'));
    console.log(`  [DRY RUN] Would execute migration (not applied)`);
    console.log(`  Preview: ${lines.length} non-comment lines`);
    return true;
  }

  try {
    // execFileSync (argv array, no shell) — DB_URL and filepath cannot be
    // interpreted as shell metacharacters. psql flags:
    //   -X                       ignore .psqlrc
    //   -v ON_ERROR_STOP=1       abort on first SQL error
    //   --single-transaction     wrap -f and -c in one BEGIN/COMMIT
    //   -v mig_version=... etc.  passed into the -c INSERT as :'mig_version'
    //                            (psql quotes these as SQL string literals)
    //
    // Bootstrap: schema_migrations must exist before the -c INSERT runs.
    // The -f file executes first within the same tx — so the init migration
    // (which creates the table) and its tracking record commit together.
    execFileSync('psql', [
      DB_URL,
      '-X',
      '-v', 'ON_ERROR_STOP=1',
      '--single-transaction',
      '-v', `mig_version=${filename}`,
      '-v', `mig_checksum=${checksum}`,
      '-f', filepath,
      '-c', "INSERT INTO schema_migrations (version, name, checksum) VALUES (:'mig_version', :'mig_version', :'mig_checksum') ON CONFLICT (version) DO NOTHING"
    ], { stdio: 'inherit' });

    return true;
  } catch (error) {
    console.error(`  Failed to apply ${filename}`);
    console.error(`  Changes were rolled back automatically (PostgreSQL transaction)`);
    console.error(error);
    return false;
  }
}

/**
 * Regenerates src/types/database.ts from the live schema via kysely-codegen.
 * Only called after a successful full apply — see partial-apply guard in main().
 */
function generateTypes(): boolean {
  console.log('\n  Generating TypeScript types from database...');
  try {
    execSync('npx kysely-codegen --dialect postgres --out-file src/types/database.ts', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: DB_URL }
    });
    return true;
  } catch (error) {
    console.error('  Failed to generate types');
    console.error(error);
    return false;
  }
}

/**
 * Pre-flight integrity check: for every applied migration in the DB, verify
 * the file on disk still exists and its checksum still matches.
 *
 * Returns true if any drift is detected. Caller decides whether that's fatal
 * (strict mode, default) or just a warning (--no-strict).
 *
 * Runs in dry-run mode too — a corrupt history is corrupt regardless of intent.
 */
async function validateAppliedMigrations(): Promise<boolean> {
  let hasConflict = false;
  try {
    const applied = await sql<{ version: string; checksum: string | null }[]>`
      SELECT version, checksum FROM schema_migrations WHERE checksum IS NOT NULL
    `;

    for (const row of applied) {
      const filepath = path.join(MIGRATIONS_DIR, row.version);
      if (!fs.existsSync(filepath)) {
        console.warn(`WARNING: ${row.version} was applied but file no longer exists on disk!`);
        hasConflict = true;
        continue;
      }
      const currentChecksum = calculateChecksum(filepath);
      if (currentChecksum !== row.checksum) {
        console.warn(`WARNING: ${row.version} was modified after being applied!`);
        console.warn(`   Expected: ${row.checksum?.slice(0, 12)}...`);
        console.warn(`   Current:  ${currentChecksum.slice(0, 12)}...`);
        hasConflict = true;
      }
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('relation "schema_migrations" does not exist')) {
      throw error; // first-run case is fine; everything else propagates
    }
  }
  return hasConflict;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log(`\n========================================`);
  console.log(`UPDATE SCHEMAS (PostgreSQL-Native)${isDryRun ? ' - DRY RUN' : ''}`);
  console.log(`========================================\n`);

  if (isDryRun) {
    console.log(`DRY RUN MODE: No changes will be applied\n`);
  }

  try {
    // ── Step 1: Acquire advisory lock ────────────────────────────────────
    // Prevents two Node runner instances from racing. pg_try_advisory_lock
    // returns false immediately rather than blocking forever — important so
    // a stale lock from a crashed run doesn't hang CI indefinitely.
    // Caveat: this only guards processes that use this script. A raw psql
    // session running migrations directly bypasses it.
    if (!isDryRun) {
      console.log(`Acquiring migration lock...`);
      const lockResult = await sql<{ pg_try_advisory_lock: boolean }[]>`
        SELECT pg_try_advisory_lock(${ADVISORY_LOCK_ID})
      `;
      if (!lockResult[0].pg_try_advisory_lock) {
        throw new Error(
          'Could not acquire migration lock — another migration process is already running. ' +
          'If no other process is running, release the lock manually:\n' +
          `  SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID});`
        );
      }
      console.log(`Lock acquired\n`);
    }

    // ── Step 2: Validate integrity of already-applied migrations ─────────
    const hasChecksumConflict = await validateAppliedMigrations();
    if (hasChecksumConflict && isStrict) {
      throw new Error('ABORTED: Migration file(s) were modified after being applied. To bypass (not recommended): add --no-strict flag');
    }

    // ── Step 3: Diff disk vs. DB to find pending migrations ──────────────
    const appliedMigrations = await getAppliedMigrations();
    const allFiles = getSQLFiles();
    const pendingFiles = allFiles.filter(f => !appliedMigrations.includes(f));

    console.log(`Previously applied migrations: ${appliedMigrations.length}`);
    console.log(`Total SQL files: ${allFiles.length}`);

    if (pendingFiles.length === 0) {
      console.log(`\nNo pending migrations to apply.\n`);
      return;
    }

    console.log(`\nPending migrations: ${pendingFiles.length}`);
    pendingFiles.forEach(f => console.log(`  - ${f}`));

    // ── Step 4: Apply each pending migration in order ────────────────────
    // Stop on first failure — applySQLFile already rolled back via psql's
    // single-transaction, so the DB is consistent. Don't continue past a
    // broken migration (would skip an ordered step).
    console.log(`\n------------------------------------------`);
    console.log(`Applying migrations...`);
    console.log(`------------------------------------------\n`);

    const appliedFiles: string[] = [];
    for (const file of pendingFiles) {
      const success = await applySQLFile(file);
      if (success) {
        appliedFiles.push(file);
        console.log(`  Applied: ${file}\n`);
      } else {
        console.log(`  Failed: ${file}`);
        console.log(`\nStopping - please fix errors before continuing.\n`);
        break;
      }
    }

    if (appliedFiles.length === 0) {
      console.log(`\nNo migrations were applied.\n`);
      return;
    }

    // Dry-run exit point — placed before the partial-apply guard so the flow
    // reads top-to-bottom without depending on dry-run always succeeding.
    if (isDryRun) {
      console.log(`\n========================================`);
      console.log(`DRY RUN COMPLETE!`);
      console.log(`========================================\n`);
      console.log(`Would have applied ${appliedFiles.length} migration(s):`);
      appliedFiles.forEach(f => console.log(`  [APPLIED] ${f}`));
      console.log(`\nTo apply these migrations, run without --dry-run flag\n`);
      return;
    }

    // ── Step 5: Regenerate types (only after a full clean apply) ─────────
    // A partial apply leaves the schema mid-migration — generating types
    // here would freeze that incomplete state into the codebase.
    if (appliedFiles.length < pendingFiles.length) {
      console.log(`\nPartial apply (${appliedFiles.length}/${pendingFiles.length}) — skipping type generation.`);
      console.log(`Fix the failing migration, then run db:migrate again.\n`);
      return;
    }

    console.log(`\n------------------------------------------`);
    console.log(`Generating Types...`);
    console.log(`------------------------------------------\n`);

    if (!generateTypes()) {
      console.log(`\nType generation failed - you may need to run manually.\n`);
      console.log(`  Run: npm run db:types\n`);
      return;
    }

    // ── Done ─────────────────────────────────────────────────────────────
    console.log(`\n========================================`);
    console.log(`COMPLETE!`);
    console.log(`========================================\n`);
    console.log(`Applied ${appliedFiles.length} migration(s):`);
    appliedFiles.forEach(f => console.log(`  [APPLIED] ${f}`));
    console.log(``);
  } finally {
    // ── Step 6: Always release lock + close connection ───────────────────
    // Unlock is wrapped in its own try/catch — a failed unlock must NOT
    // mask the original error from the try block above. (Session-scoped
    // locks also auto-release when the connection closes, so this is
    // belt-and-suspenders.)
    if (!isDryRun) {
      try {
        await sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`;
      } catch {}
    }
    await sql.end({ timeout: 5 });
  }
}

// main()'s finally always closes sql — no .catch() handler needed for that.
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});