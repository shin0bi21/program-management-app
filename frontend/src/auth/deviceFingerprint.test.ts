import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDeviceFingerprint, getDeviceName } from './deviceFingerprint';

describe('device identity', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('creates and then reuses a persistent device identifier', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');

    const first = getDeviceFingerprint();
    const second = getDeviceFingerprint();

    expect(first).toBe(second);
    expect(first).toContain('00000000-0000-4000-8000-000000000001|');
    expect(crypto.randomUUID).toHaveBeenCalledOnce();
  });

  it.each([
    ['Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0', 'Edge on Windows'],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36', 'Chrome on Android'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1', 'Safari on iOS'],
  ])('identifies %s', (userAgent, expectedName) => {
    vi.stubGlobal('navigator', { userAgent });
    expect(getDeviceName()).toBe(expectedName);
  });
});
