import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

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
  it('redirects youth away from pages requiring permissions they do not have', () => {
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
