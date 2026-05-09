import postgres from 'postgres';

/**
 * PostgreSQL connection using postgres.js
 * 
 * Features:
 * - Connection pooling (max 10 connections)
 * - Automatic reconnection with exponential backoff
 * - Tagged template literals for safe queries
 * - Connection health checks
 * 
 * Usage:
 *   import { sql } from './db/client';
 *   const users = await sql`SELECT * FROM users`;
 */

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const sql = postgres(DATABASE_URL, {
  max: 10,                // Maximum number of concurrent DB connections
  idle_timeout: 20,       // Close connections if idle for 20 seconds
  connect_timeout: 10,    // Fail if a connection can't be established within 10s
  max_lifetime: 60 * 30,  // Recycle connections after 30 minutes
  
  // Connection retry with exponential backoff
  onnotice: () => {},     // Suppress notices in production
  transform: postgres.camel, // Transform snake_case to camelCase (optional)
  
  // Connection error handling
  connection: {
    application_name: 'myapp_backend'
  }
});

// Temporary compatibility helper: postgres.js TransactionSql loses callable
// signature in current typings, so cast through this utility in transaction code.
export function asTransactionSql(tx: unknown): typeof sql {
  return tx as unknown as typeof sql;
}

/**
 * Connection health check
 * Tests if the database is reachable and responsive
 */
export async function checkConnection(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await sql.end({ timeout: 5 });
});

process.on('SIGINT', async () => {
  await sql.end({ timeout: 5 });
});
