#!/usr/bin/env node

/**
 * SNAPSHOT DATA — export and verify a private PostgreSQL recovery archive.
 * Flow: validate output/help, export and verify the archive, then report success.
 * See usage() for commands and required configuration.
 */

import { requireEnv } from '../../src/utils/env';
import { snapshotData } from './helpers/snapshot-data';

type SnapshotArguments = { help: true } | { help: false; outputFile: string };

/**
 * Validates the requested output, exports a private archive, and reports success.
 * @example main() // with --help, prints usage without database configuration.
 */
function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  snapshotData({ databaseUrl: requireEnv('DATABASE_URL'), outputFile: options.outputFile });
  console.log('Database snapshot exported and verified.');
}

/**
 * Requires one output path, or a standalone help flag, before export configuration.
 * @example parseArgs(['--output', '/private/database.dump']).outputFile // '/private/database.dump'
 */
function parseArgs(args: string[]): SnapshotArguments {
  if (args.length === 1 && ['-h', '--help'].includes(args[0])) return { help: true };
  if (args.length !== 2 || args[0] !== '--output' || !args[1] || args[1].startsWith('--')) {
    throw new Error(usage());
  }

  return { outputFile: args[1], help: false };
}

/**
 * Describes private snapshot output and required local tools.
 * @example usage().includes('--output FILE') // true
 */
function usage(): string {
  return `Usage: npx tsx db/scripts/snapshot-data.ts --output FILE

  --output FILE  Export to a new private archive; existing files are rejected.
  -h, --help     Show help without database access.

Requires DATABASE_URL and local pg_dump/pg_restore clients.
Exports and verifies the archive without changing the source database.`;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    // Export helpers return safe summaries; configuration errors contain no URL.
    console.error(error instanceof Error ? error.message : 'Snapshot failed');
    process.exitCode = 1;
  }
}
