/**
 * LOCAL IMPORT PREPARATION — replace imported authentication for local use.
 *
 * Called by import-data.sh after restore and strict migrations, before
 * database activation. Business records stay intact; copied passwords and
 * tokens are disabled, and the configured local admin is created or reset.
 *
 * CLI: npx tsx db/scripts/import-data.ts
 * Requires development mode, outbound operations disabled, a local staging URL,
 * ADMIN_EMAIL, and ADMIN_PASSWORD. All database changes share one transaction.
 */

// ============================================================================
// 1. Imports
// ============================================================================

import postgres from 'postgres';
import { seedAdmin } from './helpers/seed-admin';

// ============================================================================
// 2. Local-only configuration and staging guards
// ============================================================================

interface LocalImportConfiguration {
  databaseUrl: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
}

/**
 * Validates development isolation, a local staging URL, and administrator credentials from the supplied environment; invalid settings throw.
 * @example localImportConfiguration(env).adminFirstName // 'Local' when ADMIN_FIRST_NAME is omitted
 */
export function localImportConfiguration(env: NodeJS.ProcessEnv): LocalImportConfiguration {
  // 1. Require development mode and outbound isolation before accepting a target.
  if (env.NODE_ENV !== 'development') {
    throw new Error('Import preparation requires NODE_ENV=development');
  }
  if (env.DISABLE_OUTBOUND !== 'true') {
    throw new Error('Import preparation requires DISABLE_OUTBOUND=true');
  }
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  // 2. Restrict the target to the local staging database on the db service.
  const databaseUrl = new URL(env.DATABASE_URL);

  if (
    !['postgres:', 'postgresql:'].includes(databaseUrl.protocol)
    || databaseUrl.hostname !== 'db'
    || (databaseUrl.port !== '' && databaseUrl.port !== '5432')
    || !/^\/local_snapshot_[a-z0-9_]+$/.test(databaseUrl.pathname)
    || databaseUrl.search !== ''
    || databaseUrl.hash !== ''
  ) {
    throw new Error('Import preparation only accepts a staging database named local_snapshot_* on db:5432');
  }

  // 3. Require local credentials before returning administrator configuration.
  if (!env.ADMIN_EMAIL?.trim() || !env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured for the local administrator');
  }

  return {
    databaseUrl: env.DATABASE_URL,
    adminEmail: env.ADMIN_EMAIL.trim(),
    adminPassword: env.ADMIN_PASSWORD,
    adminFirstName: env.ADMIN_FIRST_NAME || 'Local',
    adminLastName: env.ADMIN_LAST_NAME || 'Administrator',
  };
}

// ============================================================================
// 3. Authentication replacement and connection cleanup
// ============================================================================

/**
 * Replaces copied authentication and resets the local administrator in one transaction on a validated staging configuration; always closes its connection.
 * @example await prepareLocalImport(configuration) // copied logins disabled, configured local admin enabled
 */
export async function prepareLocalImport(configuration: LocalImportConfiguration) {
  // 1. Open a single owned connection for the validated staging database.
  const sql = postgres(configuration.databaseUrl, { max: 1 });

  try {
    // 2. Replace copied authentication and seed the local administrator in one transaction.
    await sql.begin(async tx => {
      // Match the application transaction adapter for the postgres.js callable-typing issue.
      const trx = tx as unknown as typeof sql;

      // 2.1. Disable copied tokens and passwords while preserving business records.
      // Discard all copied authentication material while preserving business records and account state.
      await trx`TRUNCATE user_refresh_tokens, user_auth_codes, user_password_reset_tokens,
        user_trusted_devices, system_revoked_tokens`;
      await trx`UPDATE user_credentials SET password_hash = '!local-snapshot-disabled',
        failed_login_attempts = 0, locked_until = NULL, last_login = NULL, updated_at = NOW()`;

      // 2.2. Create or reset the configured local administrator in the same transaction.
      await seedAdmin(trx, {
        email: configuration.adminEmail,
        password: configuration.adminPassword,
        firstName: configuration.adminFirstName,
        lastName: configuration.adminLastName,
      }, { resetExisting: true });
    });
  } finally {
    // 3. Close the owned connection even when preparation fails.
    await sql.end({ timeout: 5 });
  }
}

// ============================================================================
// 4. Entrypoint — validate the target before preparing authentication
// ============================================================================

if (require.main === module) {
  Promise.resolve().then(() => localImportConfiguration(process.env)).then(prepareLocalImport).then(() => {
    console.log('Local imported authentication prepared. Only the configured local administrator can sign in.');
  }).catch(() => {
    // Database exceptions can include restored values; keep production data out of terminal logs.
    console.error('Local import preparation failed. Verify the staging database and local administrator configuration.');
    process.exitCode = 1;
  });
}
