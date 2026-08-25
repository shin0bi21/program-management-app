// Scope: verifies Users route permissions, preferences, query wiring, and account action entry points.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Users from './Users';
import type { AccountPreference } from './types';
import { toggleAccountStatus } from './accounts.api';
import type { Account } from '../../../common/types/account';
import { formatShortDate } from '../../../common/utils/date';

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
    expect(mockUseUserTableData).not.toHaveBeenCalled();

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

  it('renders each account column, including the styled status cell', () => {
    mockUseAuth.mockReturnValue({ role: 'admin', permissions: ['read:accounts'] });
    renderPage();

    const row = screen.getByText('Alice Admin').closest('tr');
    if (!row) throw new Error('Expected Alice Admin account row');
    const accountRow = within(row);

    expect(accountRow.getByText('alice@example.com')).toBeInTheDocument();
    expect(accountRow.getByText('Admin')).toBeInTheDocument();
    expect(accountRow.getByText(formatShortDate(accounts[0].createdAt))).toBeInTheDocument();
    expect(accountRow.getByText('Active')).toHaveClass('status-badge', 'status-active');
    expect(accountRow.queryByText('[object Object]')).not.toBeInTheDocument();
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

  it('replaces a toggled account in every cached table variant without refetching', async () => {
    mockUseAuth.mockReturnValue({ role: 'admin', permissions: ['read:accounts', 'write:accounts'] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const firstKey = ['accounts', 'table', { statuses: ['active'] }] as const;
    const secondKey = ['accounts', 'table', { search: 'Alice' }] as const;
    const activeAccount = accounts[0] as Account;
    const unaffectedAccount = accounts[1] as Account;
    const savedAccount = { ...activeAccount, status: 'inactive' } as Account;
    for (const [key, rows] of [[firstKey, [activeAccount, unaffectedAccount]], [secondKey, [activeAccount]]] as const) {
      client.setQueryData(key, { pages: [{ rows, nextCursor: null }], pageParams: [undefined] });
    }
    const cachedUnaffectedAccount = client.getQueryData<{ pages: { rows: Account[] }[] }>(firstKey)?.pages[0].rows[1];
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
    vi.mocked(toggleAccountStatus).mockResolvedValue(savedAccount);
    renderPage(client);

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Alice Admin' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('Account deactivated')).toBeInTheDocument();
    expect(toggleAccountStatus).toHaveBeenCalledWith('admin-1');
    expect(client.getQueryData<{ pages: { rows: Account[] }[] }>(firstKey)?.pages[0].rows).toEqual([savedAccount, unaffectedAccount]);
    expect(client.getQueryData<{ pages: { rows: Account[] }[] }>(firstKey)?.pages[0].rows[1]).toBe(cachedUnaffectedAccount);
    expect(client.getQueryData<{ pages: { rows: Account[] }[] }>(secondKey)?.pages[0].rows).toEqual([savedAccount]);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('sends applied role and status filters and clears them by category or together', () => {
    mockUseAuth.mockReturnValue({ role: 'admin', permissions: ['read:accounts', 'write:accounts'] });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Status' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Active' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Invited' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    expect(mockUseUserTableData).toHaveBeenLastCalledWith(
      ['accounts', 'table'],
      expect.objectContaining({ statuses: ['active', 'invited'] }),
      expect.any(Object),
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Back to filter categories' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Role' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Admin' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Staff' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    expect(mockUseUserTableData).toHaveBeenLastCalledWith(
      ['accounts', 'table'],
      expect.objectContaining({
        roles: ['admin', 'staff'],
        statuses: ['active', 'invited'],
      }),
      expect.any(Object),
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear' }));
    expect(mockUseUserTableData).toHaveBeenLastCalledWith(
      ['accounts', 'table'],
      expect.objectContaining({ roles: [], statuses: ['active', 'invited'] }),
      expect.any(Object),
    );

    fireEvent.click(screen.getByRole('menuitem', { name: 'Back to filter categories' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear all' }));
    expect(mockUseUserTableData).toHaveBeenLastCalledWith(
      ['accounts', 'table'],
      expect.objectContaining({ roles: [], statuses: [] }),
      expect.any(Object),
    );
  });
});
