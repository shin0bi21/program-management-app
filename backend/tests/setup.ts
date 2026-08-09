// Test setup - runs before all tests
import { config } from 'dotenv';
import { resolve } from 'path';

// Docker-backed local tests must override the backend container's development
// env. In CI, workflow-provided values point at the hosted test service and
// must win over Docker-only hostnames such as `db_test`.
config({
  path: resolve(__dirname, '../.env.test'),
  override: process.env.CI !== 'true',
});

if (!/_test(\b|$)/.test(process.env.DATABASE_URL ?? '')) {
  // Hard guard: never let tests run against a non-test DB. Catches a missing
  // .env.test file or accidental override.
  throw new Error(
    `Refusing to run tests: DATABASE_URL does not look like a test database ` +
    `(expected name to end in _test). Got: ${process.env.DATABASE_URL ?? '<unset>'}`
  );
}

import { sql } from '../src/db/client';

// Increase timeout for database operations
jest.setTimeout(10000);

// Suppress console noise in test output. Tests that need to assert on log
// calls should re-spy locally with a mock implementation in their own file.
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Clean up after all tests
afterAll(async () => {
  // Close database connection
  await sql.end({ timeout: 5 });
});
