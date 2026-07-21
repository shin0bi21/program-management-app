import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';

const authState = vi.hoisted(() => ({
  permissions: [] as string[],
  role: 'youth',
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    permissions: authState.permissions,
    role: authState.role,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../../hooks/useFloatingMenu', () => ({
  useFloatingMenu: () => ({
    isOpen: true,
    toggle: vi.fn(),
    close: vi.fn(),
    position: { top: 0, left: 0 },
    menuRef: { current: null },
  }),
}));

describe('Header youth navigation', () => {
  it('shows only My Account in application navigation for youth', () => {
    authState.permissions = [];
    authState.role = 'youth';
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'My Account' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Youth' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Schools' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Outreach' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Manage Accounts' })).not.toBeInTheDocument();
  });

  it('shows Outreach as top-level navigation for users with outreach access', () => {
    authState.permissions = ['read:outreach'];
    authState.role = 'staff';

    render(
      <MemoryRouter initialEntries={['/outreach/expressions-of-interest']}>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Outreach' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Expression of Interest' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Leads' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Expressions of Interest' })).not.toBeInTheDocument();
  });

  it('does not expose a standalone Schools destination', () => {
    authState.permissions = ['read:schools', 'write:schools'];
    authState.role = 'staff';

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Schools' })).not.toBeInTheDocument();
  });
});
