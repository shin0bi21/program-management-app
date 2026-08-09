import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../http/client';
import { login, resend2FA, verify2FA } from './auth.api';

vi.mock('../http/client', () => ({
  apiClient: { post: vi.fn() },
}));

describe('auth API', () => {
  beforeEach(() => vi.mocked(apiClient.post).mockReset());

  it('maps the backend 2FA response into the frontend login contract', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      message: 'Verification required',
      requires2FA: true,
      userId: 'user-1',
    });

    await expect(login('test@example.com', 'password', 'device-1')).resolves.toEqual({
      message: 'Verification required',
      requiresVerification: true,
      userId: 'user-1',
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/auth/login',
      { email: 'test@example.com', password: 'password', deviceFingerprint: 'device-1' },
      { auth: false },
    );
  });

  it('keeps verification and resend requests unauthenticated', () => {
    verify2FA('user-1', '123456', true, 'device-1', 'Browser');
    resend2FA('user-1');

    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/auth/verify', {
      userId: 'user-1',
      code: '123456',
      trustDevice: true,
      deviceFingerprint: 'device-1',
      deviceName: 'Browser',
    }, { auth: false });
    expect(apiClient.post).toHaveBeenNthCalledWith(
      2,
      '/auth/resend',
      { userId: 'user-1' },
      { auth: false },
    );
  });
});
