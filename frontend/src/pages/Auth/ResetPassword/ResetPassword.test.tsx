import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetPassword } from '../../../auth/auth.api';
import ResetPassword from './ResetPassword';

vi.mock('../../../auth/auth.api', () => ({ resetPassword: vi.fn() }));

function renderPage(path = '/reset-password?token=reset-token') {
  return render(
    <MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ResetPassword />
    </MemoryRouter>,
  );
}

describe('ResetPassword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('disables submission and explains a missing reset token', () => {
    renderPage('/reset-password');

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid or missing reset token.');
    expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled();
  });

  it('renders confirmation validation before calling the reset API', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'different-password' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Reset password' }).closest('form')!);

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('submits matching rendered passwords through the reset workflow', async () => {
    vi.mocked(resetPassword).mockResolvedValue({});
    renderPage();

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'new-password' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Reset password' }).closest('form')!);

    expect(await screen.findByRole('status')).toHaveTextContent('Password reset successful');
    expect(resetPassword).toHaveBeenCalledOnce();
  });
});
