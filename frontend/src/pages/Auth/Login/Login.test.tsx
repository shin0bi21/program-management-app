import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from './Login';
import { rememberAuthPath, setAuthData } from '../../../auth/storage';

vi.mock('../../../auth/authContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));

vi.mock('./hooks/useLogin', () => ({
  useLogin: () => ({
    form: {
      register: vi.fn(() => ({})),
      handleSubmit: vi.fn(),
      formState: { errors: {}, isSubmitting: false },
    },
    error: '',
    onSubmit: vi.fn(),
  }),
}));

describe('Login', () => {
  beforeEach(() => localStorage.clear());

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
});
