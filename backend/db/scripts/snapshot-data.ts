#!/usr/bin/env node

/**
 * SNAPSHOT DATA — export and verify a private PostgreSQL recovery archive.
 * Usage: npx tsx db/scripts/snapshot-data.ts --output /private/path/database.dump
 * Requires DATABASE_URL and local pg_dump/pg_restore clients.
 */

import { requireEnv } from '../../src/utils/env';
import { snapshotData } from './helpers/snapshot-data';

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--output' || !args[1] || args[1].startsWith('--')) {
      throw new Error('Usage: snapshot-data.ts --output FILE');
    }
    snapshotData({ databaseUrl: requireEnv('DATABASE_URL'), outputFile: args[1] });
    console.log('Database snapshot exported and verified.');
  } catch (error) {
    // Export helpers return safe summaries; configuration errors contain no URL.
    console.error(error instanceof Error ? error.message : 'Snapshot failed');
    process.exitCode = 1;
  }
}
