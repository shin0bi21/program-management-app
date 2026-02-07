#!/usr/bin/env node

/**
 * UPDATE SCHEMAS
 * 
 * Applies pending SQL migrations and generates TypeScript types.
 * Uses PostgreSQL for migration tracking (schema_migrations table).
 * 
 * Usage:
 *   npx tsx db/scripts/update_schemas.ts
 *   npx tsx db/scripts/update_schemas.ts --dry-run
 */

import { execSync } from 'child_process';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const ADVISORY_LOCK_ID = 123456789; // Consistent lock ID for migration safety

// Parse DATABASE_URL for psql connection
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

// Initialize postgres.js connection
const sql = postgres(DATABASE_URL);

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d');

// Get applied migrations from database
async function getAppliedMigrations(): Promise<string[]> {
  try {
    const result = await sql<{ version: string }[]>`
      SELECT version FROM schema_migrations ORDER BY applied_at
    `;
    return result.map(r => r.version);
  } catch (error) {
    // schema_migrations table doesn't exist yet (first run)
    return [];
  }
}

// Record migration as applied in database
async function recordMigration(filename: string, checksum: string): Promise<void> {
  await sql`
    INSERT INTO schema_migrations (version, name, checksum)
    VALUES (${filename}, ${filename}, ${checksum})
    ON CONFLICT (version) DO NOTHING
  `;
}

// Calculate SHA-256 checksum of file
function calculateChecksum(filepath: string): string {
  const content = fs.readFileSync(filepath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Get all SQL files in migrations directory
function getSQLFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort(); // Ensure chronological order
}

// Apply SQL file to database
async function applySQLFile(filename: string): Promise<boolean> {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  console.log(`  Applying: ${filename}`);
  
  // Calculate checksum
  const checksum = calculateChecksum(filepath);
  console.log(`  Checksum: ${checksum.slice(0, 12)}...`);
  
  if (isDryRun) {
    console.log(`  [DRY RUN] Would execute migration (not applied)`);
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('--'));
    console.log(`  Preview: ${lines.length} SQL statements`);
    return true;
  }
  
  try {
    // PostgreSQL features:
    // --single-transaction: Wrap entire file in BEGIN/COMMIT (auto-rollback on error)
    // -v ON_ERROR_STOP=1: Stop immediately on first error
    // -X: Ignore .psqlrc files
    const command = `psql "${DATABASE_URL}" -X -v ON_ERROR_STOP=1 --single-transaction -f ${filepath}`;
    execSync(command, { stdio: 'inherit' });
    
    // Record in database with checksum
    await recordMigration(filename, checksum);
    
    return true;
  } catch (error) {
    console.error(`  Failed to apply ${filename}`);
    console.error(`  Changes were rolled back automatically (PostgreSQL transaction)`);
    console.error(error);
    return false;
  }
}

// Generate TypeScript types from database
function generateTypes(): boolean {
  console.log('\n  Generating TypeScript types from database...');
  try {
    execSync('npx kysely-codegen --dialect postgres --out-file src/types/database.ts', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL }
    });
    return true;
  } catch (error) {
    console.error('  Failed to generate types');
    console.error(error);
    return false;
  }
}

// Validate checksums of applied migrations
async function validateAppliedMigrations(): Promise<void> {
  try {
    const applied = await sql<{ version: string; checksum: string | null }[]>`
      SELECT version, checksum FROM schema_migrations WHERE checksum IS NOT NULL
    `;
    
    for (const row of applied) {
      const filepath = path.join(MIGRATIONS_DIR, row.version);
      if (fs.existsSync(filepath)) {
        const currentChecksum = calculateChecksum(filepath);
        if (currentChecksum !== row.checksum) {
          console.warn(`WARNING: ${row.version} was modified after being applied!`);
          console.warn(`   Expected: ${row.checksum?.slice(0, 12)}...`);
          console.warn(`   Current:  ${currentChecksum.slice(0, 12)}...`);
        }
      }
    }
  } catch (error) {
    // Ignore validation errors (e.g., table doesn't exist yet)
  }
}

// Main execution
async function main() {
  console.log(`\n========================================`);
  console.log(`UPDATE SCHEMAS (PostgreSQL-Native)${isDryRun ? ' - DRY RUN' : ''}`);
  console.log(`========================================\n`);
  
  if (isDryRun) {
    console.log(`DRY RUN MODE: No changes will be applied\n`);
  }
  
  try {
    // Acquire advisory lock to prevent concurrent migrations (skip in dry-run)
    if (!isDryRun) {
      console.log(`Acquiring migration lock...`);
      await sql`SELECT pg_advisory_lock(${ADVISORY_LOCK_ID})`;
      console.log(`Lock acquired\n`);
    }
    
    // Validate checksums of applied migrations
    await validateAppliedMigrations();
    
    // Get applied migrations from database
    const appliedMigrations = await getAppliedMigrations();
    console.log(`Previously applied migrations: ${appliedMigrations.length}`);
    
    // Get all SQL files
    const allFiles = getSQLFiles();
    console.log(`Total SQL files: ${allFiles.length}`);
    
    // Find pending migrations
    const pendingFiles = allFiles.filter(f => !appliedMigrations.includes(f));
    
    if (pendingFiles.length === 0) {
      console.log(`\nNo pending migrations to apply.\n`);
      return;
    }
    
    console.log(`\nPending migrations: ${pendingFiles.length}`);
    pendingFiles.forEach(f => console.log(`  - ${f}`));
    
    console.log(`\n------------------------------------------`);
    console.log(`Applying migrations...`);
    console.log(`------------------------------------------\n`);
    
    // Apply each pending migration
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
    
    // In dry-run mode, show summary and exit
    if (isDryRun) {
      console.log(`\n========================================`);
      console.log(`DRY RUN COMPLETE!`);
      console.log(`========================================\n`);
      console.log(`Would have applied ${appliedFiles.length} migration(s):`);
      appliedFiles.forEach(f => console.log(`  [APPLIED] ${f}`));
      console.log(`\nTo apply these migrations, run without --dry-run flag\n`);
      return;
    }
    
    // Generate TypeScript types from database schema
    console.log(`\n------------------------------------------`);
    console.log(`Generating Types...`);
    console.log(`------------------------------------------\n`);
    
    if (!generateTypes()) {
      console.log(`\nType generation failed - you may need to run manually.\n`);
      console.log(`  Run: npm run db:types\n`);
      return;
    }
    
    console.log(`\n========================================`);
    console.log(`COMPLETE!`);
    console.log(`========================================\n`);
    console.log(`Applied ${appliedFiles.length} migration(s):`);
    appliedFiles.forEach(f => console.log(`  [APPLIED] ${f}`));
    console.log(``);
  } finally {
    // Always release lock and close connection
    if (!isDryRun) {
      await sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_ID})`;
    }
    await sql.end({ timeout: 5 });
  }
}

main().catch(async error => {
  console.error('Fatal error:', error);
  await sql.end({ timeout: 5 });
  process.exit(1);
});