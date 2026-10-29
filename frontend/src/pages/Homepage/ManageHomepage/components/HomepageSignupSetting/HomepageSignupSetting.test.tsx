import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomepageSignupSetting from './HomepageSignupSetting';

const state = vi.hoisted(() => ({
  permissions: ['read:homepage', 'write:homepage'],
  signupEnabled: true as boolean | undefined,
  loading: false,
  saving: false,
  error: null as string | null,
  refresh: vi.fn(),
  setSignupEnabled: vi.fn(),
}));
vi.mock('../../../../../auth/authContext', () => ({ useAuth: () => state }));
vi.mock('../../hooks/useHomepageSignupSetting', () => ({ useHomepageSignupSetting: () => state }));

describe('HomepageSignupSetting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.permissions = ['read:homepage', 'write:homepage'];
    state.signupEnabled = true;
    state.loading = false;
    state.saving = false;
    state.error = null;
  });

  it('lets homepage writers change signup availability', async () => {
    render(<HomepageSignupSetting />);
    expect(screen.getByRole('heading', { name: 'Manage Signup Form' })).toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: 'Disable signups' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(toggle);
    expect(state.setSignupEnabled).toHaveBeenCalledWith(false);
  });

  it('shows status without a toggle to read-only users', () => {
    state.permissions = ['read:homepage'];
    render(<HomepageSignupSetting />);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('shows loading without claiming signup is closed', () => {
    state.signupEnabled = undefined;
    state.loading = true;
    render(<HomepageSignupSetting />);
    expect(screen.getByRole('status', { name: 'Loading signup setting…' })).toBeInTheDocument();
    expect(screen.queryByText('Closed')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('retries signup errors through its own flow and blocks duplicate saves', async () => {
    state.error = 'Could not save signup';
    state.saving = true;
    render(<HomepageSignupSetting />);
    expect(screen.getByRole('switch')).toBeDisabled();
    await userEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Retry' }));
    expect(state.refresh).toHaveBeenCalledOnce();
  });
});
