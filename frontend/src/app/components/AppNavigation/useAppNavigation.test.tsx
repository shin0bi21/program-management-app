// Scope: verifies navigation capability derivation and active-route state.
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../../auth/authContext';
import { useAppNavigation } from './useAppNavigation';

const auth: AuthContextValue = {
  isAuthenticated: true,
  role: 'staff',
  permissions: [],
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/staff/hours']}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('useAppNavigation', () => {
  beforeEach(() => {
    auth.permissions = [];
  });

  it('derives Hours and Staff visibility from the canonical Hours permission', () => {
    auth.permissions = ['read:hours'];

    const { result } = renderHook(() => useAppNavigation(), { wrapper });

    expect(result.current.permissions.canViewHours).toBe(true);
    expect(result.current.permissions.canViewTasks).toBe(false);
    expect(result.current.permissions.canViewStaff).toBe(true);
    expect(result.current.active.staff).toBe(true);
    expect(result.current.isActive('/staff/hours')).toBe(true);
  });

  it('keeps Staff visible for task-only users without granting Hours access', () => {
    auth.permissions = ['read:tasks'];

    const { result } = renderHook(() => useAppNavigation(), { wrapper });

    expect(result.current.permissions.canViewHours).toBe(false);
    expect(result.current.permissions.canViewTasks).toBe(true);
    expect(result.current.permissions.canViewStaff).toBe(true);
  });
});
