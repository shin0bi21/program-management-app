// Test setup - runs before all tests
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from project root (one level up from backend/)
config({ path: resolve(__dirname, '../../.env') });

import { sql } from '../src/db/client';

// Increase timeout for database operations
jest.setTimeout(10000);

// Clean up after all tests
afterAll(async () => {
  // Close database connection
  await sql.end({ timeout: 5 });
});
