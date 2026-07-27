import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Login from './Login';

vi.mock('../../../common/context/AuthContext', () => ({
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
  it('sends an authenticated user to My Account', () => {
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
});
