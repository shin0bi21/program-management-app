import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../../auth/authContext';
import { useAppNavigation } from './useAppNavigation';

const floatingMenus = vi.hoisted(() => Array.from({ length: 5 }, () => ({
  isOpen: false,
  toggle: vi.fn(),
  close: vi.fn(),
  position: null,
  menuRef: { current: null },
})));
let floatingMenuCall = 0;

vi.mock('../../../common/components/FloatingMenu/hooks/useFloatingMenu', () => ({
  useFloatingMenu: () => floatingMenus[(floatingMenuCall++) % floatingMenus.length],
}));

const auth: AuthContextValue = {
  isAuthenticated: true,
  role: 'staff',
  permissions: [],
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
};
let navigateFromRouter: ReturnType<typeof useNavigate>;

function NavigationDriver({ children }: { children: ReactNode }) {
  navigateFromRouter = useNavigate();
  return children;
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={['/staff/hours']}>
      <NavigationDriver>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </NavigationDriver>
    </MemoryRouter>
  );
}

describe('useAppNavigation', () => {
  beforeEach(() => {
    auth.permissions = [];
    floatingMenuCall = 0;
    floatingMenus.forEach(menu => {
      menu.toggle.mockReset();
      menu.close.mockReset();
    });
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

  it('keeps menus mutually exclusive and closes navigation state after routing', async () => {
    const { result } = renderHook(() => useAppNavigation(), { wrapper });
    floatingMenus.forEach(menu => menu.close.mockClear());

    act(() => result.current.toggleMenu('staff'));
    expect(floatingMenus[3].toggle).toHaveBeenCalledOnce();
    expect(floatingMenus[3].close).not.toHaveBeenCalled();
    [0, 1, 2, 4].forEach(index => expect(floatingMenus[index].close).toHaveBeenCalledOnce());

    floatingMenus.forEach(menu => menu.close.mockClear());
    act(() => result.current.setMobileOpen(true));
    act(() => result.current.go('/settings/account'));

    await waitFor(() => expect(result.current.isActive('/settings/account')).toBe(true));
    expect(result.current.mobileOpen).toBe(false);
    floatingMenus.forEach(menu => expect(menu.close).toHaveBeenCalled());
  });

  it('closes stale menus when routing happens outside the navigation hook', async () => {
    const { result } = renderHook(() => useAppNavigation(), { wrapper });
    floatingMenus.forEach(menu => menu.close.mockClear());

    act(() => navigateFromRouter('/settings/account'));

    await waitFor(() => expect(result.current.isActive('/settings/account')).toBe(true));
    floatingMenus.forEach(menu => expect(menu.close).toHaveBeenCalledOnce());
  });
});
