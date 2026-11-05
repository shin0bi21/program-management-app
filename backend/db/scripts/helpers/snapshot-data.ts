/**
 * SNAPSHOT DATA — export a verified, private PostgreSQL recovery archive.
 *
 * Accepts the caller's database URL and requires local pg_dump/pg_restore clients. Existing snapshots
 * are never overwritten; failed exports leave no published archive.
 */

// ============================================================================
// 1. Imports and snapshot configuration
// ============================================================================

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { closeSync, existsSync, linkSync, mkdirSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface SnapshotOptions {
  databaseUrl: string;
  outputFile: string;
}

// ============================================================================
// 2. PostgreSQL environment and private diagnostics
// ============================================================================

function databaseEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.pathname.slice(1)) {
    throw new Error('Invalid PostgreSQL connection configuration');
  }

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

function privateDiagnostic(directory: string, detail: string): void {
  try {
    writeFileSync(join(directory, `snapshot-error-${randomBytes(8).toString('hex')}.log`), detail, {
      mode: 0o600, flag: 'wx',
    });
  } catch {
    // A diagnostic write failure must not expose connection details to the CLI.
  }
}

// ============================================================================
// 3. Shared dump operation for recovery, schema, data, and seed exports
// ============================================================================

/** Writes a new private dump file; callers choose pg_dump's export format. */
export function dumpDatabase(databaseUrl: string, outputFile: string, args: readonly string[]): void {
  const directory = dirname(resolve(outputFile));
  let outputFd: number | undefined;
  let created = false;
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const env = databaseEnvironment(databaseUrl);
    outputFd = openSync(outputFile, 'wx', 0o600);
    created = true;
    const result = spawnSync('pg_dump', [...args], {
      env, encoding: 'utf8', stdio: ['ignore', outputFd, 'pipe'], maxBuffer: 64 * 1024 * 1024,
    });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.error?.message || 'pg_dump did not complete');
    }
  } catch (error) {
    privateDiagnostic(directory, error instanceof Error ? error.message : String(error));
    if (created) rmSync(outputFile, { force: true });
    throw new Error('Database export failed; private diagnostics retained beside the output', { cause: error });
  } finally {
    if (outputFd !== undefined) closeSync(outputFd);
  }
}

// ============================================================================
// 4. Verify and atomically publish a complete recovery snapshot
// ============================================================================

export function snapshotData(options: SnapshotOptions): void {
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

  const partial = join(directory, `.snapshot-${randomBytes(8).toString('hex')}.partial`);
  try {
    dumpDatabase(databaseUrl, partial, ['--format=custom', '--no-owner', '--no-acl', '--no-tablespaces']);
    // Listing the archive is offline and catches incomplete/invalid dump output.
    const verification = spawnSync('pg_restore', ['--list', partial], {
      encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 64 * 1024 * 1024,
    });
    if (verification.status !== 0) {
      throw new Error(verification.stderr || verification.error?.message || 'Archive verification failed');
    }

    // A same-directory hard link publishes without overwriting a concurrent file
    // or exposing a partially copied archive, and preserves the private file mode.
    linkSync(partial, output);
  } catch (error) {
    privateDiagnostic(directory, error instanceof Error ? error.message : String(error));
    throw new Error('Snapshot failed; private diagnostics retained beside the output', { cause: error });
  } finally {
    rmSync(partial, { force: true });
  }
}

