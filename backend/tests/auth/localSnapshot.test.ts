import { localSnapshotConfiguration } from '../../db/scripts/prepare-local-snapshot';

const valid = {
  NODE_ENV: 'development', DISABLE_OUTBOUND: 'true',
  DATABASE_URL: 'postgresql://local:password@db:5432/local_snapshot_20261027_abc',
  ADMIN_EMAIL: 'local@example.test', ADMIN_PASSWORD: 'local-secret',
};

describe('local snapshot preparation guards', () => {
  it('accepts only an isolated local staging database and configured login', () => {
    expect(localSnapshotConfiguration(valid)).toMatchObject({ adminEmail: 'local@example.test' });
  });

  it.each([
    { NODE_ENV: 'production' },
    { DISABLE_OUTBOUND: 'false' },
    { DATABASE_URL: 'postgresql://user:password@production.example/app' },
    { DATABASE_URL: 'postgresql://user:password@db/app' },
    { DATABASE_URL: 'postgresql://user:password@db/local_snapshot_safe?host=production.example' },
    { ADMIN_PASSWORD: '' },
  ])('rejects unsafe preparation configuration %p', overrides => {
    expect(() => localSnapshotConfiguration({ ...valid, ...overrides })).toThrow();
  });
});
