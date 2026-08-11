import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { getLastAuthPath, rememberAuthPath, setAuthData } from '../../../auth/storage';

vi.mock('../../../auth/authContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    permissions: [],
    role: 'youth',
    loading: false,
  }),
}));

function Location() {
  return <span>{useLocation().pathname}</span>;
}

describe('ProtectedRoute youth access', () => {
  beforeEach(() => {
    localStorage.clear();
    setAuthData('token', {
      id: 'user-1',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
    });
  });

  it('remembers the current authenticated path and query for this user', () => {
    render(
      <MemoryRouter initialEntries={['/programming/sessions?session=session-1']}>
        <ProtectedRoute><span>Sessions page</span></ProtectedRoute>
      </MemoryRouter>,
    );

    expect(getLastAuthPath('user-1')).toBe('/programming/sessions?session=session-1');
  });

  it('redirects youth away from pages requiring permissions they do not have', () => {
    rememberAuthPath('user-1', '/settings/account');

    render(
      <MemoryRouter initialEntries={['/youth']}>
        <Routes>
          <Route path="/" element={<Location />} />
          <Route path="/youth" element={<ProtectedRoute requiredPermission="read:youth_profiles"><span>Youth management</span></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.queryByText('Youth management')).not.toBeInTheDocument();
    expect(getLastAuthPath('user-1')).toBe('/settings/account');
  });

  it('allows youth to access My Account without an additional permission', () => {
    render(
      <MemoryRouter initialEntries={['/settings/account']}>
        <Routes>
          <Route path="/settings/account" element={<ProtectedRoute><span>My Account page</span></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('My Account page')).toBeInTheDocument();
  });
});
