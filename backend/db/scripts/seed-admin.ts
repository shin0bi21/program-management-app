#!/usr/bin/env node

/** Creates the configured administrator without changing an existing account. */
import postgres from 'postgres';
import { adminSeedConfiguration, seedAdmin } from './helpers/seed-admin';

/**
 * Creates the configured administrator in one transaction, reports whether it already existed, and always closes its connection.
 * @example // npm run seed:admin preserves an existing account's credentials.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['-h', '--help'].includes(args[0])) {
    console.log(usage());
    return;
  }
  if (args.length > 0) throw new Error(usage());

  // 1. Require complete administrator configuration before opening the connection.
  const configuration = adminSeedConfiguration();
  const sql = postgres(configuration.databaseUrl, { max: 1 });

  try {
    // 2. Seed inside one transaction, preserving existing accounts by default.
    const result = await sql.begin(transaction => {
      // Match the application adapter for postgres.js transaction callable typings.
      return seedAdmin(transaction as unknown as typeof sql, configuration);
    });

    // 3. Report whether the administrator was created or already existed.
    if (!result.created) {
      console.log(`Account already exists for ${configuration.email}; credentials were left unchanged.`);
      return;
    }

    console.log(`Admin user created: ${configuration.email}`);
    console.log(`Name: ${configuration.firstName} ${configuration.lastName}`);
    console.log('Admin can now log in with the configured credentials.');
  } finally {
    // 4. Close the owned connection on every path.
    await sql.end({ timeout: 5 });
  }
}

/**
 * Describes the command and its required configuration without opening a connection.
 * @example usage().includes('--help') // true
 */
function usage(): string {
  return `Usage: npm run seed:admin -- [--help]

Creates the configured administrator; existing credentials remain unchanged.
Requires DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD.
Optional ADMIN_FIRST_NAME and ADMIN_LAST_NAME set the new account name.
  -h, --help  Show help without reading configuration or opening a connection.`;
}

if (require.main === module) {
  main().catch(() => {
    // Database exceptions may contain query values, including credential material.
    console.error('Admin seeding failed. Verify the database init, DATABASE_URL, and ADMIN_* configuration.');
    process.exitCode = 1;
  });
}
