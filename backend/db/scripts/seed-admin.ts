#!/usr/bin/env node

/**
 * ADMIN USER SEEDING
 * 
 * Creates the initial admin user from environment variables.
 * Idempotent - safe to run multiple times (won't duplicate).
 * 
 * Usage:
 *   npx tsx db/scripts/seed-admin.ts
 * 
 * Required env vars:
 *   ADMIN_EMAIL - Admin email address
 *   ADMIN_PASSWORD - Admin password (plaintext, will be hashed)
 *   ADMIN_FIRST_NAME - Admin first name (optional, defaults to "Admin")
 *   ADMIN_LAST_NAME - Admin last name (optional, defaults to "User")
 */

import postgres from 'postgres';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.error('ERROR: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required');
  console.error('\nUsage:');
  console.error('  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=SecurePass123! npx tsx db/scripts/seed-admin.ts');
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME || 'Admin';
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME || 'User';

const sql = postgres(DATABASE_URL);

async function main() {
  console.log(`\n========================================`);
  console.log(`ADMIN USER SEEDING`);
  console.log(`========================================\n`);
  
  try {
    // Check if admin already exists
    const existing = await sql`
      SELECT user_id FROM user_credentials WHERE email = ${ADMIN_EMAIL}
    `;
    
    if (existing.length > 0) {
      console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
      console.log(`Skipping creation.\n`);
      return;
    }
    
    console.log(`Creating admin user: ${ADMIN_EMAIL}`);
    
    // Generate secure password hash
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    
    // Generate UUID (idempotency handled by email check above)
    const adminId = crypto.randomUUID();
    
    // Insert admin user
    await sql`
      INSERT INTO users (id, first_name, last_name, permission) 
      VALUES (${adminId}::uuid, ${ADMIN_FIRST_NAME}, ${ADMIN_LAST_NAME}, 'admin'::permission_level)
    `;
    
    // Insert admin credentials
    await sql`
      INSERT INTO user_credentials (user_id, email, password_hash, email_verified) 
      VALUES (${adminId}::uuid, ${ADMIN_EMAIL}, ${passwordHash}, true)
    `;
    
    console.log(`\n========================================`);
    console.log(`ADMIN USER CREATED SUCCESSFULLY`);
    console.log(`========================================\n`);
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Name: ${ADMIN_FIRST_NAME} ${ADMIN_LAST_NAME}`);
    console.log(`\nAdmin can now log in with the provided credentials.\n`);
    
  } catch (error) {
    console.error('ERROR: Failed to create admin user');
    console.error(error);
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await sql.end({ timeout: 5 });
  process.exit(1);
});
