import { afterEach, describe, expect, it, vi } from 'vitest';

describe('HTTP API configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('joins a configured base URL and route with one slash', async () => {
    vi.stubEnv('VITE_API_URL', 'https://example.test/api/');
    const { api } = await import('./config');

    expect(api('/accounts')).toBe('https://example.test/api/accounts');
    expect(api('accounts')).toBe('https://example.test/api/accounts');
  });

  it('uses the /api fallback when no URL is configured', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const { api } = await import('./config');

    expect(api('/health')).toBe('/api/health');
  });
});
// @vitest-environment node
