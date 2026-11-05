module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Index source imports as well as tests for --findRelatedTests traversal.
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/types/**',
    '!src/index.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 15000,
  // Clean output configuration
  silent: process.env.JEST_SILENT !== 'false',
  verbose: true,
  bail: false,
  // Run sequentially to avoid DB contention between suites
  maxWorkers: 1,
  // Node16 moduleResolution emits .js extensions in source; Jest resolves .ts files directly
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
