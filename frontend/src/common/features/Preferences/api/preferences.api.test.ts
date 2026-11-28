// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../../http/client';
import { getPreference, setPreference } from './preferences.api';

vi.mock('../../../../http/client', () => ({
  apiClient: { get: vi.fn(), put: vi.fn() },
}));

describe('preferences API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads persisted JSON and forwards request options', () => {
    const controller = new AbortController();
    getPreference('session-filters', { signal: controller.signal });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/preferences/session-filters',
      { signal: controller.signal },
    );
  });

  it('writes the selected preference value', () => {
    const value = { statuses: ['active'], programIds: [] };
    setPreference('youth-profile-filters', value);

    expect(apiClient.put).toHaveBeenCalledWith('/preferences/youth-profile-filters', value);
  });
});
