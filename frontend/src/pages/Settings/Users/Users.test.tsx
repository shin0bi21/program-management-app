import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Users from './Users';

const mockUseAuth = vi.fn();
const mockUseAccounts = vi.fn();
const preferenceHook = vi.hoisted(() => ({ preference: null, loading: false, error: null, save: vi.fn() }));

vi.mock('../../../auth/authContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('./hooks/useAccounts', () => ({ useAccounts: (filters: unknown) => mockUseAccounts(filters) }));
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
    preferenceHook.save.mockReset();
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

    expect(preferenceHook.save).toHaveBeenCalledWith({
      statuses: [], roles: [], sorting: { key: 'name', direction: 'asc' }, columnWidths: {}, hiddenColumns: ['email'],
    });
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
    expect(mockUseAccounts).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Yara' }));
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
    expect(mockUseAccounts).toHaveBeenLastCalledWith(expect.objectContaining({ statuses: ['active', 'invited'] }));

    fireEvent.click(screen.getByRole('menuitem', { name: 'Back to filter categories' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Role' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Admin' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Staff' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    expect(mockUseAccounts).toHaveBeenLastCalledWith(expect.objectContaining({
      roles: ['admin', 'staff'],
      statuses: ['active', 'invited'],
    }));

    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear' }));
    expect(mockUseAccounts).toHaveBeenLastCalledWith(expect.objectContaining({
      roles: [],
      statuses: ['active', 'invited'],
    }));

    fireEvent.click(screen.getByRole('menuitem', { name: 'Back to filter categories' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear all' }));
    expect(mockUseAccounts).toHaveBeenLastCalledWith(expect.objectContaining({ roles: [], statuses: [] }));
  });
});
