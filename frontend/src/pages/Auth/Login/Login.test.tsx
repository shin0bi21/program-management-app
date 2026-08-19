import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { login } from '../../../auth/auth.api';
import { rememberAuthPath, setAuthData } from '../../../auth/storage';
import Login from './Login';

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  loading: false,
  login: vi.fn(),
}));

vi.mock('../../../auth/authContext', () => ({
  useAuth: () => authState,
}));
vi.mock('../../../auth/auth.api', () => ({ login: vi.fn() }));

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authState.isAuthenticated = true;
    authState.loading = false;
  });

  it('sends an authenticated user to My Account by default', () => {
    setAuthData('token', { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/settings/account" element={<div>Account page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Account page')).toBeInTheDocument();
  });

  it('returns an authenticated user to their last visited page', () => {
    setAuthData('token', { id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com' });
    rememberAuthPath('user-1', '/programming/sessions?session=session-1');

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/programming/sessions" element={<div>Sessions page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Sessions page')).toBeInTheDocument();
  });

  it('blocks invalid credentials before the API boundary', async () => {
    authState.isAuthenticated = false;
    render(<MemoryRouter><Login /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);

    expect(await screen.findByText('Invalid email address')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });
});
