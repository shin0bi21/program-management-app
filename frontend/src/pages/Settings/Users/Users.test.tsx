// Owns Users route permissions, preferences, query wiring, and account action entry points.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Users from './Users';
import type { AccountPreference } from './hooks/useAccountControls';

const mockUseAuth = vi.fn();
const mockUseUserTableData = vi.fn();
const preferenceHook = vi.hoisted(() => ({
  preference: null as AccountPreference | null,
  loading: false,
  error: null,
  initializePreference: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../../../auth/authContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('./components/UserTable/hooks/useUserTableData', () => ({
  default: (...args: unknown[]) => mockUseUserTableData(...args),
}));
vi.mock('../../../common/features/preferences/hooks/useUserPreference', () => ({
  default: () => preferenceHook,
}));
vi.mock('./accounts.api', () => ({
  revokeAccountInvite: vi.fn(),
  toggleAccountStatus: vi.fn(),
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

const renderPage = (client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => ({
  client,
  ...render(
  <QueryClientProvider client={client}>
    <Users />
  </QueryClientProvider>,
  ),
});

describe('Users', () => {
  beforeEach(() => {
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.initializePreference.mockImplementation((value: AccountPreference) => {
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
    mockUseUserTableData.mockReset();
    mockUseUserTableData.mockReturnValue({
      rows: accounts,
      loading: false,
      error: '',
    });
  });

  it('shows admin account controls and sends search state to the accounts query', async () => {
    mockUseAuth.mockReturnValue({ role: 'admin', permissions: ['read:accounts', 'write:accounts', 'write:youth_profiles'] });
    renderPage();

    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    expect(screen.getByRole('menuitem', { name: 'Invite Staff' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Invite Youth' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search accounts' }), { target: { value: 'Yara' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(mockUseUserTableData).toHaveBeenLastCalledWith(
      ['accounts', 'table'],
      expect.objectContaining({ search: 'Yara' }),
      expect.any(Object),
    );
  });

  it('shows the staff-scoped presentation without staff-management controls', () => {
    mockUseAuth.mockReturnValue({ role: 'staff', permissions: ['read:accounts', 'write:accounts', 'write:youth_profiles'] });
    mockUseUserTableData.mockReturnValue({
      rows: [accounts[1]],
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

  it('opens the account status confirmation from the table action', async () => {
    mockUseAuth.mockReturnValue({ role: 'admin', permissions: ['read:accounts', 'write:accounts'] });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Alice Admin' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Deactivate' }));

    expect(screen.getByRole('heading', { name: 'Deactivate Account' })).toBeInTheDocument();
    expect(screen.getByText('Deactivate login access for Alice Admin?')).toBeInTheDocument();
  });

});
