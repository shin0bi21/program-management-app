import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetPassword } from '../../../auth/auth.api';
import ResetPassword from './ResetPassword';

vi.mock('../../../auth/auth.api', () => ({ resetPassword: vi.fn() }));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual<typeof import('react-router-dom')>('react-router-dom'),
  useNavigate: () => navigate,
}));

/**
 * Renders the password recovery page at the supplied URL.
 * @param path - Recovery route with an optional emailed reset token.
 * @example renderPage('/reset-password') // page with the missing-token warning
 */
function renderPage(path = '/reset-password?token=reset-token') {
  return render(
    <StrictMode><MemoryRouter
      initialEntries={[path]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ResetPassword />
    </MemoryRouter></StrictMode>,
  );
}

describe('ResetPassword', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

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

  it('submits matching passwords and returns to login after the existing success delay', async () => {
    vi.useFakeTimers();
    vi.mocked(resetPassword).mockResolvedValue({});
    renderPage();
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'new-password' } });
    await act(async () => fireEvent.submit(screen.getByRole('button', { name: 'Reset password' }).closest('form')!));

    expect(screen.getByRole('status')).toHaveTextContent('Password reset successful');
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument();
    expect(resetPassword).toHaveBeenCalledWith('reset-token', 'new-password');
    expect(navigate).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('cancels the delayed redirect when the reset flow unmounts', async () => {
    vi.useFakeTimers();
    vi.mocked(resetPassword).mockResolvedValue({});
    const view = renderPage();
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'new-password' } });
    await act(async () => fireEvent.submit(screen.getByRole('button', { name: 'Reset password' }).closest('form')!));

    view.unmount();
    act(() => vi.runAllTimers());
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not redirect when a pending reset finishes after unmount', async () => {
    vi.useFakeTimers();
    let resolveReset!: (value: object) => void;
    vi.mocked(resetPassword).mockReturnValue(new Promise(resolve => { resolveReset = resolve; }));
    const view = renderPage();
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'new-password' } });
    await act(async () => fireEvent.submit(screen.getByRole('button', { name: 'Reset password' }).closest('form')!));

    view.unmount();
    await act(async () => resolveReset({}));
    act(() => vi.runAllTimers());
    expect(navigate).not.toHaveBeenCalled();
  });
});
