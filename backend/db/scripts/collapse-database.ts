#!/usr/bin/env node

/**
 * DATABASE COLLAPSE — database/file worker for the host maintenance wrapper.
 *
 * Usage: npx tsx db/scripts/collapse-database.ts --phase prepare|commit|rollback|cleanup
 *   --work-directory /maintenance --apply [--reuse-baseline]
 *
 * DATABASE_URL identifies the server and target. MIGRATION_FILES_ROOT selects
 * writable migration files. The caller stops the application, owns the operation
 * lock, and verifies health between prepare and commit. Recovery files are private
 * and retained; this worker never starts containers or removes the old database.
 */

// ============================================================================
// 1. Imports and operation contracts
// ============================================================================

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { INIT_FILES as initFiles, calculateChecksum as checksum, listMigrationFiles, migrationFilePath, readBaseline } from './helpers/read-migrations';
import type { AppliedMigration as Migration, Baseline } from './helpers/read-migrations';
import { requireEnv } from '../../src/utils/env';
import { dumpDatabase, snapshotData } from './helpers/snapshot-data';

type Phase = 'prepare' | 'commit' | 'rollback' | 'cleanup';
interface Options { phase: Phase; work: string; reuse: boolean }
interface State {
  format: 1;
  id: string;
  target: string;
  capture: string;
  stage: string;
  backup: string;
  reuse: boolean;
  phase: 'preparing' | 'prepared' | 'committing' | 'committed' | 'rolled-back';
  frozen: boolean;
  captured: boolean;
  staged: boolean;
  oldRenamed: boolean;
  switched: boolean;
  published: boolean;
  rollbackFailed: boolean;
}

const initFilePaths = Object.values(initFiles);
const ledger = 'public.schema_migrations';
const fileGroups = ['migrations', 'schema', 'data', 'baseline.json'];

// ============================================================================
// 2. Export comparison and source-history checks
// ============================================================================

/**
 * Removes pg_dump comments and randomized psql restriction keys for schema comparison, preserving SQL content.
 * @example normalizeDump('-- exported\nSELECT 1;') // 'SELECT 1;'
 */
export function normalizeDump(sql: string): string {
  // pg_dump randomizes psql restriction keys and includes version/date comments.
  return sql.split('\n').filter(line => !line.startsWith('--') && !/^\\(?:un)?restrict\b/.test(line))
    .join('\n').trim();
}

/**
 * Requires identical migration versions and checksums with no duplicates; order does not affect comparison and mismatches throw.
 * @example verifyHistory([], []) // returns normally
 */
export function verifyHistory(records: Migration[], expected: Migration[]): void {
  // 1. Index actual and expected versions to detect duplicate history entries.
  const actual = new Map(records.map(row => [row.version, row.checksum]));
  const expectedVersions = new Set(expected.map(row => row.version));
  // 2. Require identical versions and checksums at the collapse boundary.
  if (actual.size !== records.length || expectedVersions.size !== expected.length || actual.size !== expected.length
    || expected.some(row => !actual.has(row.version) || actual.get(row.version) !== row.checksum)) {
    throw new Error('Migration history does not match the collapse boundary. Apply the matching migrations first.');
  }
}

/**
 * Reads the validated migration catalog under databaseFiles and computes a checksum for every version.
 * @example migrationInventory('/repo/db') // ordered version/checksum pairs
 */
function migrationInventory(databaseFiles: string): Migration[] {
  return listMigrationFiles(databaseFiles).map(version => ({
    version, checksum: checksum(migrationFilePath(databaseFiles, version)),
  }));
}

// ============================================================================
// 3. CLI parsing and private recovery state
// ============================================================================

/**
 * Parses one maintenance phase and an absolute recovery directory; requires explicit --apply and rejects invalid options.
 * @example parseArgs(['--phase', 'prepare', '--work-directory', '/maintenance', '--apply']).phase // 'prepare'
 */
function parseArgs(args: string[]): Options {
  // 1. Parse the maintenance phase, private work directory, and explicit apply mode.
  let phase: Phase | undefined;
  let work = '';
  let apply = false;
  let reuse = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--phase') {
      const value = args[++index];
      if (!['prepare', 'commit', 'rollback', 'cleanup'].includes(value)) throw new Error('Invalid --phase');
      phase = value as Phase;
    } else if (arg === '--work-directory') work = args[++index] || '';
    else if (arg === '--apply') apply = true;
    else if (arg === '--reuse-baseline') reuse = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  // 2. Reject incomplete requests and relative recovery directories.
  if (!apply || !phase || !work || !isAbsolute(work)) {
    throw new Error('--phase, absolute --work-directory, and --apply are required');
  }
  return { phase, work: resolve(work), reuse };
}

/**
 * Executes one validated maintenance phase using private persisted state; preserves recovery files and attempts rollback only before commit.
 * @example collapse({ phase: 'cleanup', work: '/maintenance', reuse: false }) // removes disposable databases after commit or rollback
 */
export function collapse(options: Options): void {
  // 1. Validate the configured server and target database before maintenance work.
  const databaseUrl = requireEnv('DATABASE_URL');
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid database URL');
  const target = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(target) || /^(postgres|template[01]|collapse_.*)$/.test(target)) {
    throw new Error('Unsafe target database name');
  }

  // 2. Load or create private recovery state bound to this exact target.
  const work = options.work;
  const databaseFiles = resolve(requireEnv('MIGRATION_FILES_ROOT'));
  mkdirSync(work, { recursive: true, mode: 0o700 });
  chmodSync(work, 0o700);
  const stateFile = join(work, 'state.json');
  let state: State;
  if (existsSync(stateFile)) {
    state = JSON.parse(readFileSync(stateFile, 'utf8')) as State;
    if (state.format !== 1 || !/^[a-f0-9]{16}$/.test(state.id) || state.target !== target
      || state.capture !== `collapse_capture_${state.id}` || state.stage !== `collapse_stage_${state.id}`
      || state.backup !== `collapse_backup_${state.id}`
      || !['preparing', 'prepared', 'committing', 'committed', 'rolled-back'].includes(state.phase)
      || ['reuse', 'frozen', 'captured', 'staged', 'oldRenamed', 'switched', 'published', 'rollbackFailed']
        .some(key => typeof state[key as keyof State] !== 'boolean')) {
      throw new Error('Recovery state does not match this target');
    }
  } else {
    if (options.phase !== 'prepare') throw new Error('Prepare must create recovery state first');
    const id = randomBytes(8).toString('hex');
    state = {
      format: 1, id, target, capture: `collapse_capture_${id}`, stage: `collapse_stage_${id}`,
      backup: `collapse_backup_${id}`, reuse: options.reuse, phase: 'preparing', frozen: false,
      captured: false, staged: false, oldRenamed: false, switched: false, published: false, rollbackFailed: false,
    };
    saveState();
  }

  // 3. Derive operation-specific database names and private child-process settings.
  const { capture, stage, backup } = state;
  const schemaReference = `collapse_schema_${state.id}`;
  // Child credentials stay in the environment and are never persisted or passed in argv.
  const childEnv = {
    ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    ...(url.searchParams.has('sslmode') ? { PGSSLMODE: url.searchParams.get('sslmode')! } : {}),
  };

  /**
   * Atomically replaces the private operation state so later phases can recover interrupted work.
   * @example saveState() // persists the current operation flags
   */
  function saveState(): void {
    // 1. Write the complete recovery state privately before replacing the current state file.
    const temporary = `${stateFile}.tmp`;
    writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    // 2. Publish the updated state atomically for later recovery.
    renameSync(temporary, stateFile);
  }

  // ========================================================================
  // 4. PostgreSQL command helpers
  // ========================================================================

  /**
   * Runs psql against an operation database with optional SQL or file input; failures retain private diagnostics and owned input files are closed.
   * @example runPsql(target, ['-X', '-qAt'], 'SELECT 1') // '1\n'
   */
  function runPsql(database: string, args: string[], input?: string, inputFile?: string): string {
    // 1. Open an optional input file and run psql with private connection settings.
    const inputFd = inputFile ? openSync(inputFile, 'r') : undefined;
    try {
      const result = spawnSync('psql', args, {
        env: { ...childEnv, PGDATABASE: database }, input, encoding: 'utf8',
        stdio: [inputFd ?? 'pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
      });
      // 2. Retain command diagnostics privately and expose only a safe failure summary.
      if (result.status !== 0) {
        writeFileSync(join(work, 'last-error.log'), result.stderr || result.error?.message || 'Database command failed', { mode: 0o600 });
        throw new Error('Database command failed; private diagnostics retained with recovery files');
      }
      return result.stdout || '';
    } finally {
      // 3. Always close the input descriptor owned by this invocation.
      if (inputFd !== undefined) closeSync(inputFd);
    }
  }

  /**
   * Executes SQL against an operation database with fail-fast psql settings and returns trimmed output.
   * @example psql(target, 'SELECT 1') // '1'
   */
  function psql(database: string, sql: string): string {
    return runPsql(database, ['-X', '-qAt', '--set=ON_ERROR_STOP=1'], sql).trim();
  }

  /**
   * Sets connection access for a validated operation database and terminates existing sessions; command failures throw.
   * @example connections(stage, false) // prevents new connections and disconnects current sessions
   */
  function connections(database: string, allow: boolean): void {
    psql('postgres', `ALTER DATABASE "${database}" ALLOW_CONNECTIONS ${allow};
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();`);
  }

  /**
   * Exports the selected operation database to a new private file using the requested pg_dump arguments.
   * @example dump(capture, '/maintenance/schema.sql', ['--schema-only']) // writes a new schema export
   */
  function dump(database: string, file: string, args: string[]): void {
    const connection = new URL(databaseUrl);
    connection.pathname = `/${database}`;
    dumpDatabase(connection.toString(), file, ['--no-owner', '--no-acl', '--no-tablespaces', ...args]);
  }

  /**
   * Recursively copies regular migration artifacts, rejecting symlinks; recovery copies stay private and modeReference restores checkout permissions.
   * @example copyMigrationFiles('/source/schema', '/maintenance/schema') // creates a private artifact copy
   */
  function copyMigrationFiles(source: string, target: string, modeReference?: string): void {
    // 1. Inspect source artifacts and optional checkout permissions without following symlinks.
    const entry = lstatSync(source);
    const reference = modeReference && existsSync(modeReference) ? lstatSync(modeReference) : undefined;
    // 2. Copy directory children recursively and restore the requested directory mode.
    if (entry.isDirectory()) {
      mkdirSync(target, { recursive: true, mode: 0o700 });
      for (const name of readdirSync(source)) {
        copyMigrationFiles(join(source, name), join(target, name), modeReference && join(modeReference, name));
      }
      const mode = modeReference ? (reference ?? lstatSync(databaseFiles)).mode & 0o7777 : 0o700;
      chmodSync(target, mode);
      return;
    }
    // 3. Reject other file types before writing a new private regular file.
    if (!entry.isFile()) throw new Error('Migration artifacts must be regular files or directories');

    // Recovery copies stay private; publication and rollback take checkout modes
    // from the saved originals. Explicit chmod preserves them even under a strict umask.
    writeFileSync(target, readFileSync(source), { mode: 0o600, flag: 'wx' });
    const mode = modeReference
      ? (reference ?? lstatSync(join(work, 'previous-files', 'baseline.json'))).mode & 0o7777
      : 0o600;
    chmodSync(target, mode);
  }

  /**
   * Loads a SQL file atomically into an operation database; restoringData defers foreign keys and revalidates them before commit.
   * @example load(stage, '/maintenance/data.sql', true) // restores data and validates its foreign keys
   */
  function load(database: string, file: string, restoringData = false): void {
    // 1. Configure an atomic SQL load, optionally deferring foreign-key enforcement.
    const args = ['-X', '-q', '--set=ON_ERROR_STOP=1', '--single-transaction'];
    if (restoringData) args.push('-c', "SET LOCAL session_replication_role = 'replica'");
    args.push('-f', '-');
    // 2. Revalidate all restored foreign-key rows before committing the data load.
    if (restoringData) {
      // COPY may contain cycles; recreate validated FKs to check every restored row.
      args.push('-c', `SET LOCAL session_replication_role = 'origin'; DO $$
        DECLARE constraint_row record;
        BEGIN
          FOR constraint_row IN SELECT conrelid::regclass AS relation, conname,
            pg_get_constraintdef(oid) AS definition FROM pg_constraint
            WHERE contype = 'f' AND convalidated AND connamespace IN
              (SELECT oid FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema')
          LOOP
            EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', constraint_row.relation, constraint_row.conname);
            EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', constraint_row.relation, constraint_row.conname, constraint_row.definition);
          END LOOP;
        END $$;`);
    }
    // 3. Load the complete file and validation SQL in the same transaction.
    runPsql(database, args, undefined, file);
  }

  /**
   * Loads an exported schema into a temporary database and dumps its current-server representation; always drops the temporary database.
   * @example renderSourceSchema('/maintenance/schema.sql', '/maintenance/canonical.sql') // writes canonical schema SQL
   */
  function renderSourceSchema(inputFile: string, outputFile: string): void {
    // 1. Render the exported schema through the current PostgreSQL parser.
    psql('postgres', `CREATE DATABASE "${schemaReference}" TEMPLATE template0;`);
    try {
      load(schemaReference, inputFile);
      dump(schemaReference, outputFile, ['--schema-only']);
    } finally {
      // 2. Remove the temporary schema reference even when rendering fails.
      psql('postgres', `DROP DATABASE "${schemaReference}" WITH (FORCE);`);
    }
  }

  /**
   * Returns deterministic per-table row counts and content hashes, excluding the migration ledger.
   * @example fingerprints(capture) === fingerprints(stage) // true when business table contents match
   */
  function fingerprints(database: string): string {
    return psql(database, `SELECT format(
      'SELECT %L, count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '''' ORDER BY md5(to_jsonb(t)::text)), '''')) FROM %I.%I t;',
      schemaname || '.' || tablename, schemaname, tablename)
      FROM pg_tables WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND (schemaname || '.' || tablename) <> '${ledger}' ORDER BY schemaname, tablename
      \u005cgexec`);
  }

  /**
   * Returns ordered sequence values and call state, excluding the migration ledger sequence.
   * @example sequenceStates(capture) === sequenceStates(stage) // true when preserved sequence states match
   */
  function sequenceStates(database: string): string {
    return psql(database, `SELECT format('SELECT %L, last_value, is_called FROM %I.%I;',
      schemaname || '.' || sequencename, schemaname, sequencename)
      FROM pg_sequences WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        AND (schemaname || '.' || sequencename) <> coalesce(pg_get_serial_sequence('${ledger}', 'id'), '')
      ORDER BY schemaname, sequencename
      \u005cgexec`);
  }

  /**
   * Restores saved migration artifact groups and permissions, then records that candidate files are no longer published.
   * @example restoreFiles() // restores the pre-collapse source artifacts
   */
  function restoreFiles(): void {
    // 1. Restore original artifact groups and their saved checkout modes.
    const saved = join(work, 'previous-files');
    for (const name of fileGroups) {
      rmSync(join(databaseFiles, name), { recursive: true, force: true });
      if (existsSync(join(saved, name))) copyMigrationFiles(join(saved, name), join(databaseFiles, name), join(saved, name));
    }
    // 2. Persist that candidate source artifacts are no longer published.
    state.published = false;
    saveState();
  }

  // ========================================================================
  // 5. Prepare the verified candidate without publishing source files
  // ========================================================================

  /**
   * Captures and verifies the source, builds a replacement, and switches it read-only for caller health checks; interrupted preparation requires rollback.
   * @example prepare() // persists prepared state before the caller checks backend health
   */
  function prepare(): void {
    // 1. Reject interrupted preparation that requires rollback before a fresh attempt.
    if (state.phase === 'prepared') return;
    if (state.phase !== 'preparing' || state.frozen || state.captured || state.oldRenamed || state.switched) {
      throw new Error('Interrupted prepare requires rollback before a new operation');
    }
    // 2. Validate baseline seed selection and prepare private candidate directories.
    const currentBaseline = readBaseline(databaseFiles);
    if (!currentBaseline) throw new Error('Collapse requires baseline.json to select seed tables');
    const { seedTables } = currentBaseline;
    let baseline: Baseline | null = null;
    const candidate = join(work, 'candidate');
    for (const folder of ['schema/migrations', 'data/migrations']) {
      mkdirSync(join(candidate, folder), { recursive: true, mode: 0o700 });
      writeFileSync(join(candidate, folder, '.gitkeep'), '', { mode: 0o600 });
    }
    const sourceRecords = JSON.parse(psql(target, `SELECT coalesce(json_agg(t ORDER BY version), '[]') FROM (SELECT version, checksum FROM ${ledger}) t;`)) as Migration[];

    // 3. Verify source history against either the reviewed baseline or current catalog.
    if (state.reuse) {
      baseline = currentBaseline;

      verifyHistory(sourceRecords, baseline.replaces);
      for (const file of initFilePaths) {
        copyMigrationFiles(join(databaseFiles, file), join(candidate, file));
      }
      const increments = listMigrationFiles(databaseFiles).filter(version => !initFilePaths.some(file => file === version));
      if (increments.length) throw new Error('Reuse requires a clean baseline with no later migration files');
    } else {
      verifyHistory(sourceRecords, migrationInventory(databaseFiles));
    }

    // ======================================================================
    // Freeze, capture, and export the source state
    // ======================================================================

    // 4. Freeze connections and capture a consistent source database with recovery state.
    console.log('Freezing the current database...');
    // Disable new connections before terminating old sessions, including external writers.
    state.frozen = true;
    saveState();
    connections(target, false);
    psql('postgres', `CREATE DATABASE "${capture}" TEMPLATE "${target}";`);
    state.captured = true;
    saveState();
    verifyHistory(JSON.parse(psql(capture, `SELECT coalesce(json_agg(t ORDER BY version), '[]') FROM (SELECT version, checksum FROM ${ledger}) t;`)) as Migration[], sourceRecords);

    // 5. Export recovery, schema, business data, and explicit seed data.
    console.log('Exporting current schema, seed data, and a private recovery snapshot...');
    const capturedConnection = new URL(databaseUrl);
    capturedConnection.pathname = `/${capture}`;
    snapshotData({ databaseUrl: capturedConnection.toString(), outputFile: join(work, 'recovery.dump') });
    dump(capture, join(work, 'schema.sql'), ['--schema-only']);
    dump(capture, join(work, 'data.sql'), ['--data-only', `--exclude-table-data=${ledger}`]);
    dump(capture, join(work, 'seed.sql'), ['--data-only', '--inserts', ...seedTables.flatMap(table => ['--table', table])]);

    // Historical catalog expressions must pass through the current parser on both sides.
    renderSourceSchema(join(work, 'schema.sql'), join(work, 'canonical-schema.sql'));

    // 6. Build a new baseline only when reviewed artifacts are not being reused.
    if (!baseline) {
      copyMigrationFiles(join(work, 'schema.sql'), join(candidate, initFiles.schema));
      copyMigrationFiles(join(work, 'seed.sql'), join(candidate, initFiles.data));
      baseline = {
        format: 1, id: state.id, replaces: sourceRecords, seedTables,
        files: {
          'schema/init.sql': checksum(join(candidate, initFiles.schema)),
          'data/init.sql': checksum(join(candidate, initFiles.data)),
        },
      };
    }
    writeFileSync(join(candidate, 'baseline.json'), JSON.stringify(baseline, null, 2) + '\n', { mode: 0o600 });

    // ======================================================================
    // Restore and validate both preserved-data and fresh-install paths
    // ======================================================================

    // 7. Rebuild the candidate and compare schema, table contents, and sequence state.
    console.log('Rebuilding and checking the replacement database...');
    psql('postgres', `CREATE DATABASE "${stage}" TEMPLATE template0;`);
    state.staged = true;
    saveState();
    load(stage, join(candidate, initFiles.schema));

    if (state.reuse) {
      // Compare server-rendered schemas so equivalent reviewed SQL can be reused across dump versions.
      dump(stage, join(work, 'reviewed-schema.sql'), ['--schema-only']);
      const sourceSchema = normalizeDump(readFileSync(join(work, 'canonical-schema.sql'), 'utf8'));
      const reviewedSchema = normalizeDump(readFileSync(join(work, 'reviewed-schema.sql'), 'utf8'));
      if (sourceSchema !== reviewedSchema) throw new Error('Current schema differs from the reviewed baseline');
    }

    // Preserve environment-specific seed IDs with the full snapshot, not the fresh-install seed file.
    load(stage, join(work, 'data.sql'), true);
    for (const file of initFilePaths) {
      psql(stage, `INSERT INTO ${ledger} (version, name, checksum) VALUES ('${file}', '${file}', '${checksum(join(candidate, file))}');`);
    }
    if (fingerprints(capture) !== fingerprints(stage)) throw new Error('Restored table contents differ from the source');
    if (sequenceStates(capture) !== sequenceStates(stage)) throw new Error('Restored sequence values differ from the source');
    dump(stage, join(work, 'restored-schema.sql'), ['--schema-only']);
    if (normalizeDump(readFileSync(join(work, 'canonical-schema.sql'), 'utf8')) !== normalizeDump(readFileSync(join(work, 'restored-schema.sql'), 'utf8'))) throw new Error('Restored schema differs from the source');

    // 8. Verify the fresh-install seed path separately from the preserved-data restore.
    // Exercise the seed init on an empty database too; it is not replayed over
    // the full business-data snapshot, which already contains those rows.
    psql('postgres', `DROP DATABASE "${capture}"; CREATE DATABASE "${capture}" TEMPLATE template0;`);
    load(capture, join(candidate, initFiles.schema));
    load(capture, join(candidate, initFiles.data));

    // ======================================================================
    // Verify cutover before retiring the original migration files
    // ======================================================================

    // 9. Switch database names and expose the candidate read-only for provisional health checks.
    console.log('Switching to the verified replacement...');
    psql('postgres', `ALTER DATABASE "${target}" RENAME TO "${backup}";`);
    state.oldRenamed = true;
    saveState();
    connections(stage, false);
    psql('postgres', `ALTER DATABASE "${stage}" RENAME TO "${target}";`);
    state.switched = true;
    saveState();
    // A read-only candidate permits the health check without accepting writes.
    psql('postgres', `ALTER DATABASE "${target}" SET default_transaction_read_only = on; ALTER DATABASE "${target}" ALLOW_CONNECTIONS true;`);
    state.phase = 'prepared';
    saveState();
    console.log('Candidate prepared read-only; verify backend health before commit.');
  }

  // ========================================================================
  // 6. Commit publication after the caller verifies provisional health
  // ========================================================================

  /**
   * Publishes verified artifacts and records commit before enabling writes; an already committed operation retries activation only.
   * @example commit() // enables the prepared target after the caller verifies provisional health
   */
  function commit(): void {
    // 1. Retry write activation for an already committed operation.
    if (state.phase === 'committed') {
      enableWrites();
      return;
    }
    // 2. Require a prepared replacement and original backup before publication.
    if (state.phase !== 'prepared' || !state.switched || !state.oldRenamed) {
      throw new Error('Commit requires a prepared candidate and its original backup');
    }
    state.phase = 'committing';
    saveState();
    connections(target, false);
    if (!readBaseline(join(work, 'candidate'))) {
      throw new Error('The verified candidate baseline is missing');
    }

    // 3. Save original artifacts and publish the candidate with reversible intent recorded first.
    if (!state.reuse) {
      const saved = join(work, 'previous-files');
      mkdirSync(saved, { mode: 0o700 });
      for (const name of fileGroups) {
        const original = join(databaseFiles, name);
        if (existsSync(original)) copyMigrationFiles(original, join(saved, name), original);
      }
      // Persist publication intent first so a partial file replacement is reversible.
      state.published = true;
      saveState();
      for (const name of fileGroups) {
        rmSync(join(databaseFiles, name), { recursive: true, force: true });
        const candidate = join(work, 'candidate', name);
        if (existsSync(candidate)) copyMigrationFiles(candidate, join(databaseFiles, name), join(saved, name));
      }
    }

    // 4. Persist commit before enabling writes so rollback cannot discard new records.
    // Persist the irreversible boundary before SQL can accept writes. A failed
    // activation is retried by commit; rollback must never discard newer writes.
    state.phase = 'committed';
    try { saveState(); }
    catch (error) {
      state.phase = 'committing';
      throw error;
    }
    enableWrites();
  }

  /**
   * Enables writes and connections for the committed target, retaining its original database as backup.
   * @example enableWrites() // activates the target and reports the retained backup name
   */
  function enableWrites(): void {
    psql('postgres', `ALTER DATABASE "${target}" RESET default_transaction_read_only; ALTER DATABASE "${target}" ALLOW_CONNECTIONS true;`);
    console.log(`Collapse committed; previous database retained: ${backup}`);
  }

  // ========================================================================
  // 7. Restore the original state or remove disposable staging databases
  // ========================================================================

  /**
   * Restores original files, names, and access before commit; rejects committed operations and accepts repeated successful rollback.
   * @example rollback() // restores the original target and records rolled-back state
   */
  function rollback(): void {
    // 1. Reject rollback after commit and accept an already restored operation.
    if (state.phase === 'committed') throw new Error('A committed collapse cannot be rolled back automatically');
    if (state.phase === 'rolled-back') return;
    // 2. Restore original files before reversing database names.
    if (state.published) restoreFiles();
    // 3. Move the replacement aside and restore the original target name.
    if (state.switched) {
      connections(target, false);
      psql('postgres', `ALTER DATABASE "${target}" RENAME TO "${stage}";`);
      state.switched = false;
      saveState();
    }
    if (state.oldRenamed) {
      psql('postgres', `ALTER DATABASE "${backup}" RENAME TO "${target}";`);
      state.oldRenamed = false;
      saveState();
    }
    // 4. Re-enable original database access and persist successful rollback.
    if (state.frozen) connections(target, true);
    state.frozen = false;
    state.rollbackFailed = false;
    state.phase = 'rolled-back';
    saveState();
  }

  /**
   * Drops disposable comparison and staging databases only after commit or rollback; failed rollback blocks cleanup and the original backup is retained.
   * @example cleanup() // removes temporary databases while retaining recovery files
   */
  function cleanup(): void {
    // 1. Permit cleanup only after successful commit or rollback.
    if (state.rollbackFailed) throw new Error('Cleanup prohibited after a failed rollback');
    if (state.phase !== 'committed' && state.phase !== 'rolled-back') throw new Error('Commit or rollback before cleanup');
    // 2. Remove disposable schema and capture databases, retaining the original backup.
    // The name is derived from the persisted operation ID, including after an interrupted restore.
    psql('postgres', `DROP DATABASE IF EXISTS "${schemaReference}" WITH (FORCE);`);
    if (state.captured) {
      psql('postgres', `DROP DATABASE IF EXISTS "${capture}" WITH (FORCE);`);
      state.captured = false;
      saveState();
    }
    // 3. Drop the staging database only when it is no longer the active target.
    if (state.staged && !state.switched) {
      psql('postgres', `DROP DATABASE IF EXISTS "${stage}" WITH (FORCE);`);
      state.staged = false;
      saveState();
    }
  }

  try {
    // 4. Reconcile persisted flags with PostgreSQL before dispatching the requested phase.
    if (state.rollbackFailed && options.phase !== 'rollback') {
      throw new Error('Retry rollback before continuing this operation');
    }

    // Database renames and filesystem state cannot share a transaction. Recover
    // completed rename/create steps if the process stopped before saving a flag.
    if (state.phase !== 'committed' && state.phase !== 'rolled-back') {
      const names = new Set(psql('postgres', `SELECT datname FROM pg_database WHERE datname IN
        ('${target}', '${capture}', '${stage}', '${backup}');`).split('\n'));
      state.captured = names.has(capture);
      state.staged = names.has(stage) || (names.has(backup) && names.has(target));
      state.oldRenamed = names.has(backup);
      state.switched = names.has(backup) && names.has(target) && !names.has(stage);
      saveState();
    }

    // 5. Execute one maintenance phase using the recovered operation state.
    if (options.phase === 'prepare') prepare();
    else if (options.phase === 'commit') commit();
    else if (options.phase === 'rollback') rollback();
    else cleanup();
  } catch (error) {
    // 6. Attempt automatic recovery only before the committed write boundary.
    if ((options.phase === 'prepare' || options.phase === 'commit') && state.phase !== 'committed') {
      try { rollback(); }
      catch {
        state.rollbackFailed = true;
        saveState();
        throw new Error('Collapse failed and automatic rollback failed; preserve recovery files and databases');
      }
    } else if (options.phase === 'rollback' && state.phase !== 'committed') {
      state.rollbackFailed = true;
      saveState();
    }
    throw error;
  }
}

// ============================================================================
// 8. Entrypoint
// ============================================================================

if (require.main === module) {
  try { collapse(parseArgs(process.argv.slice(2))); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
