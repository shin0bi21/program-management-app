#!/usr/bin/env node

/**
 * MIGRATION STATUS
 * 
 * Shows applied vs pending migrations with timestamps.
 * 
 * Usage:
 *   npx tsx db/scripts/migration_status.ts
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

interface MigrationRecord {
  version: string;
  applied_at: Date;
  checksum: string | null;
}

// Get applied migrations from database
async function getAppliedMigrations(): Promise<MigrationRecord[]> {
  try {
    const result = await sql<MigrationRecord[]>`
      SELECT version, applied_at, checksum 
      FROM schema_migrations 
      ORDER BY applied_at
    `;
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('relation "schema_migrations" does not exist')) {
      return []; // first run — init migration hasn't been applied yet
    }
    throw error;
  }
}

// Get all SQL files in migrations directory
function getAllMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

// Calculate SHA-256 checksum of file
function calculateChecksum(filepath: string): string {
  const content = fs.readFileSync(filepath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Main execution
async function main() {
  console.log(`\n========================================`);
  console.log(`MIGRATION STATUS`);
  console.log(`========================================\n`);
  
  try {
    const applied = await getAppliedMigrations();
    const allFiles = getAllMigrationFiles();
    const appliedVersions = new Set(applied.map(m => m.version));
    const pending = allFiles.filter(f => !appliedVersions.has(f));
    
    // Applied migrations
    if (applied.length > 0) {
      console.log(`Applied Migrations (${applied.length}):`);
      console.log(`${'─'.repeat(80)}`);
      
      for (const migration of applied) {
        const timestamp = new Date(migration.applied_at).toISOString().replace('T', ' ').slice(0, 19);
        console.log(`  [APPLIED] ${migration.version}`);
        console.log(`    Applied: ${timestamp}`);
        
        // Check if file still exists and validate checksum
        const filepath = path.join(MIGRATIONS_DIR, migration.version);
        if (fs.existsSync(filepath)) {
          if (migration.checksum) {
            const currentChecksum = calculateChecksum(filepath);
            if (currentChecksum !== migration.checksum) {
              console.log(`    WARNING: File has been modified after being applied!`);
              console.log(`    Expected: ${migration.checksum.slice(0, 12)}...`);
              console.log(`    Current:  ${currentChecksum.slice(0, 12)}...`);
            } else {
              console.log(`    Checksum: ${migration.checksum.slice(0, 12)}... OK`);
            }
          }
        } else {
          console.log(`    WARNING: Migration file not found!`);
        }
        console.log();
      }
    } else {
      console.log(`No migrations applied yet.\n`);
    }
    
    // Pending migrations
    if (pending.length > 0) {
      console.log(`Pending Migrations (${pending.length}):`);
      console.log(`${'─'.repeat(80)}`);
      
      for (const file of pending) {
        const filepath = path.join(MIGRATIONS_DIR, file);
        const stats = fs.statSync(filepath);
        const size = (stats.size / 1024).toFixed(2);
        console.log(`  - ${file}`);
        console.log(`    Size: ${size} KB`);
        console.log();
      }
    } else {
      console.log(`No pending migrations - database is up to date!\n`);
    }
    
    // Summary
    console.log(`${'═'.repeat(80)}`);
    console.log(`Summary: ${applied.length} applied, ${pending.length} pending`);
    console.log(`${'═'.repeat(80)}\n`);
    
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
