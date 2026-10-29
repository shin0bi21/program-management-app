import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resend2FA, verify2FA } from '../../../auth/auth.api';
import VerifyPassword from './VerifyPassword';

const authLogin = vi.hoisted(() => vi.fn());

vi.mock('../../../auth/auth.api', () => ({ resend2FA: vi.fn(), verify2FA: vi.fn() }));
vi.mock('../../../auth/authContext', () => ({
  useAuth: () => ({ login: authLogin }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[{
      pathname: '/verify-password',
      state: { userId: 'user-1' },
    }]}
    >
      <VerifyPassword />
    </MemoryRouter>,
  );
}

describe('VerifyPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normalizes the rendered code input and validates its required length', async () => {
    renderPage();

    const code = screen.getByLabelText('Verification code');
    fireEvent.change(code, { target: { value: '12a34' } });
    expect(code).toHaveValue('1234');
    fireEvent.submit(screen.getByRole('button', { name: 'Verify' }).closest('form')!);

    expect(await screen.findByText('Code must be 6 digits')).toBeInTheDocument();
    expect(verify2FA).not.toHaveBeenCalled();
  });

  it('wires the rendered resend action to its status message', async () => {
    vi.mocked(resend2FA).mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'New verification code sent to your email',
    );
    expect(resend2FA).toHaveBeenCalledWith('user-1');
  });

  it('submits a valid rendered code through the verification workflow', async () => {
    vi.mocked(verify2FA).mockResolvedValue({
      token: 'token',
      user: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' },
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Verify' }).closest('form')!);
    });
    expect(verify2FA).toHaveBeenCalledOnce();
    expect(authLogin).toHaveBeenCalledOnce();
  });
});
