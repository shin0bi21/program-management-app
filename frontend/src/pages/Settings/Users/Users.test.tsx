// Scope: verifies Users route permissions, preferences, query wiring, and account action entry points.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Users from './Users';
import type { AccountPreference } from './types';

const mockUseAuth = vi.fn();
const mockUseAccounts = vi.fn();
const preferenceHook = vi.hoisted(() => ({
  preference: null as AccountPreference | null,
  loading: false,
  error: null,
  setBaseline: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../../../auth/authContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('./hooks/useAccounts', () => ({
  useAccounts: (...args: unknown[]) => mockUseAccounts(...args),
}));
vi.mock('../../../common/features/preferences/hooks/useUserPreference', () => ({
  default: () => preferenceHook,
}));

const accounts = [
  {
    id: 'admin-1',
    firstName: 'Alice',
    lastName: 'Admin',
    email: 'alice@example.com',
    role: 'admin',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'youth-1',
    firstName: 'Yara',
    lastName: 'Youth',
    email: 'yara@example.com',
    role: 'youth',
    status: 'invited',
    createdAt: '2026-02-01T00:00:00Z',
  },
] as const;

const renderPage = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <Users />
  </QueryClientProvider>,
);

describe('Users', () => {
  beforeEach(() => {
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.setBaseline.mockImplementation((value: AccountPreference) => {
      preferenceHook.preference = value;
    });
    preferenceHook.save.mockReset();
    preferenceHook.save.mockImplementation((
      update: AccountPreference | ((current: AccountPreference | null) => AccountPreference),
    ) => {
      preferenceHook.preference = typeof update === 'function'
        ? update(preferenceHook.preference)
        : update;
    });
    mockUseAccounts.mockReturnValue({
      accounts,
      loading: false,
      error: '',
    });
  });

  it('persists a complete preference when first hiding a column', () => {
    mockUseAuth.mockReturnValue({ role: 'admin', permissions: ['read:accounts', 'write:accounts'] });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Email' }));

    expect(preferenceHook.preference).toEqual({
      statuses: [], roles: [], sorting: { key: 'name', direction: 'asc' }, columnWidths: {}, hiddenColumns: ['email'],
    });
  });

  it('keeps persisted controls and content unavailable until restoration completes', async () => {
    mockUseAuth.mockReturnValue({ role: 'admin', permissions: ['read:accounts', 'write:accounts'] });
    preferenceHook.loading = true;
    const rendered = renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Loading saved account preferences…');
    expect(screen.queryByRole('button', { name: 'Columns' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Accounts' })).not.toBeInTheDocument();
    expect(mockUseAccounts).toHaveBeenLastCalledWith(
      ['accounts', 'list'],
      null,
      expect.any(Object),
    );

    preferenceHook.loading = false;
    rendered.rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Users />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('button', { name: 'Columns' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Accounts' })).toBeInTheDocument();
  });

  it('shows admin account controls and sends search state to the accounts query', async () => {
    vi.useFakeTimers();
    mockUseAuth.mockReturnValue({ role: 'admin', permissions: ['read:accounts', 'write:accounts', 'write:youth_profiles'] });
    renderPage();

    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    expect(screen.getByRole('menuitem', { name: 'Invite Staff' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Invite Youth' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search accounts' }), { target: { value: 'Yara' } });
    act(() => vi.advanceTimersByTime(250));
    expect(mockUseAccounts).toHaveBeenLastCalledWith(
      ['accounts', 'list'],
      expect.objectContaining({ search: 'Yara' }),
      expect.any(Object),
    );
    vi.useRealTimers();
  });

  it('shows the staff-scoped presentation without staff-management controls', () => {
    mockUseAuth.mockReturnValue({ role: 'staff', permissions: ['read:accounts', 'write:accounts', 'write:youth_profiles'] });
    mockUseAccounts.mockReturnValue({
      accounts: [accounts[1]],
      loading: false,
      error: '',
    });

    renderPage();

    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add', expanded: false })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.queryByRole('menuitem', { name: 'Role' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByText('Yara Youth')).toBeInTheDocument();
  });

  it('sends applied role and status filters and clears them by category or together', () => {
    mockUseAuth.mockReturnValue({ role: 'admin', permissions: ['read:accounts', 'write:accounts'] });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Status' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Active' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Invited' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    expect(mockUseAccounts).toHaveBeenLastCalledWith(
      ['accounts', 'list'],
      expect.objectContaining({ statuses: ['active', 'invited'] }),
      expect.any(Object),
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Back to filter categories' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Role' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Admin' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Staff' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    expect(mockUseAccounts).toHaveBeenLastCalledWith(
      ['accounts', 'list'],
      expect.objectContaining({
        roles: ['admin', 'staff'],
        statuses: ['active', 'invited'],
      }),
      expect.any(Object),
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear' }));
    expect(mockUseAccounts).toHaveBeenLastCalledWith(
      ['accounts', 'list'],
      expect.objectContaining({ roles: [], statuses: ['active', 'invited'] }),
      expect.any(Object),
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Back to filter categories' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear all' }));
    expect(mockUseAccounts).toHaveBeenLastCalledWith(
      ['accounts', 'list'],
      expect.objectContaining({ roles: [], statuses: [] }),
      expect.any(Object),
    );
  });
});
