import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicTopBar from './PublicTopBar';

const auth = vi.hoisted(() => ({ isAuthenticated: false }));

vi.mock('../../../../auth/authContext', () => ({
  useAuth: () => auth,
}));

function renderTopBar() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<PublicTopBar />} />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/settings/account" element={<div>Account page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PublicTopBar account link', () => {
  beforeEach(() => {
    auth.isAuthenticated = false;
  });

  it('takes signed-out visitors to Login', async () => {
    const user = userEvent.setup();
    renderTopBar();

    const link = screen.getByRole('link', { name: 'Login' });
    expect(link).toHaveAttribute('href', '/login');
    await user.click(link);
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('takes authenticated visitors to My Account', async () => {
    auth.isAuthenticated = true;
    const user = userEvent.setup();
    renderTopBar();

    const link = screen.getByRole('link', { name: 'My Account' });
    expect(link).toHaveAttribute('href', '/settings/account');
    await user.click(link);
    expect(screen.getByText('Account page')).toBeInTheDocument();
  });
});
