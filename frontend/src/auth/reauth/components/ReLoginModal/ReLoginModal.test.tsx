import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login, resend2FA, verify2FA } from '../../../auth.api';
import { getUser, setAuthData } from '../../../storage';
import ReLoginModal from './ReLoginModal';

vi.mock('../../../auth.api', () => ({
  login: vi.fn(),
  verify2FA: vi.fn(),
  resend2FA: vi.fn(),
}));

vi.mock('../../../storage', () => ({
  getUser: vi.fn(),
  setAuthData: vi.fn(),
}));

vi.mock('../../../deviceFingerprint', () => ({
  getDeviceFingerprint: () => 'device-fingerprint',
  getDeviceName: () => 'Test browser',
}));

const storedUser = {
  id: 'user-1',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
};

describe('ReLoginModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUser).mockReturnValue(storedUser);
  });

  it('stores a direct-login token and completes re-authentication', async () => {
    vi.mocked(login).mockResolvedValue({
      token: 'fresh-token',
      user: storedUser,
      message: 'Login successful',
    });
    const onReAuthenticated = vi.fn();

    render(<ReLoginModal isOpen onReAuthenticated={onReAuthenticated} />);

    expect(screen.getByRole('dialog', { name: 'Session Expired' })).toHaveAccessibleDescription(
      'Your session has expired. Please enter your password to continue.',
    );
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'correct-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(onReAuthenticated).toHaveBeenCalledOnce());
    expect(login).toHaveBeenCalledWith('test@example.com', 'correct-password', 'device-fingerprint');
    expect(setAuthData).toHaveBeenCalledWith('fresh-token', storedUser);
  });

  it('completes password, resend, and 2FA verification steps', async () => {
    vi.mocked(login).mockResolvedValue({
      message: 'Verification required',
      requiresVerification: true,
      userId: 'verification-user-1',
    });
    vi.mocked(resend2FA).mockResolvedValue({});
    vi.mocked(verify2FA).mockResolvedValue({
      token: 'verified-token',
      user: storedUser,
    });
    const onReAuthenticated = vi.fn();

    render(<ReLoginModal isOpen onReAuthenticated={onReAuthenticated} />);

    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'correct-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const codeInput = await screen.findByLabelText('Verification Code');
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await waitFor(() => expect(resend2FA).toHaveBeenCalledWith('verification-user-1'));

    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(onReAuthenticated).toHaveBeenCalledOnce());
    expect(verify2FA).toHaveBeenCalledWith(
      'verification-user-1',
      '123456',
      true,
      'device-fingerprint',
      'Test browser',
    );
    expect(setAuthData).toHaveBeenCalledWith('verified-token', storedUser);
  });
});
