/**
 * SNAPSHOT DATA — export a verified, private PostgreSQL recovery archive.
 *
 * Accepts the caller's database URL and requires local pg_dump/pg_restore clients. Existing snapshots
 * are never overwritten; failed exports leave no published archive.
 */

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { closeSync, existsSync, linkSync, mkdirSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface SnapshotOptions {
  databaseUrl: string;
  outputFile: string;
}

/**
 * Exports, verifies, and atomically publishes a private custom archive; existing output is rejected and partial files are removed.
 * @example snapshotData({ databaseUrl, outputFile: '/private/recovery.dump' }) // publishes a verified new archive
 */
export function snapshotData(options: SnapshotOptions): void {
  // 1. Prepare a private output directory and reject an existing snapshot.
  const { databaseUrl, outputFile } = options;
  const output = resolve(outputFile);
  const directory = dirname(output);
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  } catch (error) {
    privateDiagnostic(directory, error instanceof Error ? error.message : String(error));
    throw new Error('Snapshot failed; unable to prepare the output directory', { cause: error });
  }
  if (existsSync(output)) throw new Error('Snapshot output already exists; choose a new output path');

  // 2. Export to a unique partial file before attempting publication.
  const partial = join(directory, `.snapshot-${randomBytes(8).toString('hex')}.partial`);
  try {
    dumpDatabase(databaseUrl, partial, ['--format=custom', '--no-owner', '--no-acl', '--no-tablespaces']);
    // 3. Verify the archive offline before exposing it as a completed snapshot.
    // Listing the archive is offline and catches incomplete/invalid dump output.
    const verification = spawnSync('pg_restore', ['--list', partial], {
      encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 64 * 1024 * 1024,
    });
    if (verification.status !== 0) {
      throw new Error(verification.stderr || verification.error?.message || 'Archive verification failed');
    }

    // 4. Publish atomically without overwriting a concurrent destination.
    // A same-directory hard link publishes without overwriting a concurrent file
    // or exposing a partially copied archive, and preserves the private file mode.
    linkSync(partial, output);
  } catch (error) {
    privateDiagnostic(directory, error instanceof Error ? error.message : String(error));
    throw new Error('Snapshot failed; private diagnostics retained beside the output', { cause: error });
  } finally {
    // 5. Always remove the owned partial path after publication or failure.
    rmSync(partial, { force: true });
  }
}

/**
 * Attempts to write diagnostic detail to a new private log under directory, suppressing write failures.
 * @example privateDiagnostic('/private/recovery', 'Export failed') // writes a private log when possible
 */
function privateDiagnostic(directory: string, detail: string): void {
  try {
    writeFileSync(join(directory, `snapshot-error-${randomBytes(8).toString('hex')}.log`), detail, {
      mode: 0o600, flag: 'wx',
    });
  } catch {
    // A diagnostic write failure must not expose connection details to the CLI.
  }
}

/**
 * Writes a new private dump file using the supplied PostgreSQL URL and pg_dump format arguments.
 * Rejects existing output; failed exports remove their output and retain private diagnostics.
 * @example dumpDatabase(databaseUrl, '/private/schema.sql', ['--schema-only']) // writes a new schema dump
 */
export function dumpDatabase(databaseUrl: string, outputFile: string, args: readonly string[]): void {
  // 1. Prepare private output ownership and reject existing destinations.
  const directory = dirname(resolve(outputFile));
  let outputFd: number | undefined;
  let created = false;
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const env = databaseEnvironment(databaseUrl);
    outputFd = openSync(outputFile, 'wx', 0o600);
    created = true;
    // 2. Stream the requested dump format directly into the exclusively created file.
    const result = spawnSync('pg_dump', [...args], {
      env, encoding: 'utf8', stdio: ['ignore', outputFd, 'pipe'], maxBuffer: 64 * 1024 * 1024,
    });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.error?.message || 'pg_dump did not complete');
    }
  } catch (error) {
    // 3. Retain private diagnostics and remove only output created by this failed export.
    privateDiagnostic(directory, error instanceof Error ? error.message : String(error));
    if (created) rmSync(outputFile, { force: true });
    throw new Error('Database export failed; private diagnostics retained beside the output', { cause: error });
  } finally {
    // 4. Close the owned output descriptor on success or failure.
    if (outputFd !== undefined) closeSync(outputFd);
  }
}

/**
 * Validates a PostgreSQL URL and returns private child-process connection settings; invalid URLs throw.
 * @example databaseEnvironment('postgres://user:secret@db/app').PGDATABASE // 'app'
 */
function databaseEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
  // 1. Validate the PostgreSQL URL before deriving child-process settings.
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.pathname.slice(1)) {
    throw new Error('Invalid PostgreSQL connection configuration');
  }

  // 2. Pass credentials through the child environment rather than command arguments.
  // Credentials belong in the child environment, never argv or recovery files.
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    ...(url.searchParams.has('sslmode') ? { PGSSLMODE: url.searchParams.get('sslmode')! } : {}),
  };
}
