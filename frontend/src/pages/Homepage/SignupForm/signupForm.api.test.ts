// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../http/client';
import { getManagedHomepageSignup, updateHomepageSignup } from './signupForm.api';

vi.mock('../../../http/client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn() },
}));

describe('signupForm API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads and updates signup independently with cancellation forwarding', async () => {
    const signal = new AbortController().signal;
    vi.mocked(apiClient.get).mockResolvedValue({ signupEnabled: true });
    vi.mocked(apiClient.patch).mockResolvedValue({ signupEnabled: false });

    expect(await getManagedHomepageSignup({ signal })).toEqual({ signupEnabled: true });
    expect(await updateHomepageSignup(false)).toEqual({ signupEnabled: false });
    expect(apiClient.get).toHaveBeenCalledWith('/homepage/signup', { signal });
    expect(apiClient.patch).toHaveBeenCalledWith('/homepage/signup', { enabled: false });
  });
});
