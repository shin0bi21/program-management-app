import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SignupForm from './SignupForm';

const auth = vi.hoisted(() => ({ permissions: ['read:homepage'] }));
const setSignupEnabled = vi.hoisted(() => vi.fn());

vi.mock('../../../auth/authContext', () => ({ useAuth: () => auth }));
vi.mock('./components/HomepageSignupSetting/hooks/useHomepageSignupSetting', () => ({
  useHomepageSignupSetting: () => ({
    signupEnabled: true,
    loading: false,
    saving: false,
    error: null,
    setSignupEnabled,
  }),
}));

describe('SignupForm', () => {
  beforeEach(() => {
    auth.permissions = ['read:homepage'];
    setSignupEnabled.mockReset();
  });

  it('keeps signup status readable without exposing changes to readers', () => {
    render(<SignupForm />);

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('lets homepage writers change signup availability from its own page', async () => {
    auth.permissions.push('write:homepage');
    const user = userEvent.setup();
    render(<SignupForm />);

    await user.click(screen.getByRole('switch', { name: 'Disable signups' }));

    expect(setSignupEnabled).toHaveBeenCalledWith(false);
  });
});
