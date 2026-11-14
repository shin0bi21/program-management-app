import { renderWithQueryClient } from '../../../tests/queryClientTestUtils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Users from './Users';

const mockUseAuth = vi.fn();
const mockUseUserTableData = vi.fn();
const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));

vi.mock('../../../auth/authContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('./components/UserTable/hooks/useUserTableData', () => ({
  default: (...args: unknown[]) => mockUseUserTableData(...args),
}));
vi.mock('../../../common/features/Preferences/preferences.api', () => preferenceApi);
vi.mock('../../../common/features/referenceData/referenceData.api', () => ({
  getSchoolReferences: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../common/features/SchoolModal/schoolModal.api', () => ({
  createSchool: vi.fn().mockResolvedValue({ id: 'school-new', name: 'Authoritative School' }),
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

/**
 * Mounts the accounts route with an isolated query cache.
 * @returns The rendered route and its QueryClient for the current test.
 * @example renderPage() // renders Users under its query provider
 */
const renderPage = () => renderWithQueryClient(<Users />);

describe('Users', () => {
  beforeEach(() => {
    preferenceApi.getPreference.mockResolvedValue(null);
    preferenceApi.setPreference.mockImplementation((_key, value) => Promise.resolve(value));
    mockUseUserTableData.mockReset();
    mockUseUserTableData.mockReturnValue({
      rows: accounts,
      loading: false,
      error: '',
    });
  });

  // Entry and readiness.
  it('offers staff and youth invitations to administrators', async () => {
    mockUseAuth.mockReturnValue({ role: 'admin', permissions: ['read:accounts', 'write:accounts', 'write:youth_profiles'] });
    renderPage();
    await screen.findByRole('button', { name: 'Filters' });
    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    expect(screen.getByRole('menuitem', { name: 'Invite Staff' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Invite Youth' })).toBeInTheDocument();
  });

  it('waits for restored account filters before querying the table', async () => {
    mockUseAuth.mockReturnValue({ role: 'admin', permissions: ['read:accounts'] });
    let restore!: (value: { statuses: string[] }) => void;
    preferenceApi.getPreference.mockReturnValueOnce(new Promise(resolve => { restore = resolve; }));
    renderPage();

    expect(mockUseUserTableData).not.toHaveBeenCalled();

    await act(async () => restore({ statuses: ['invited'] }));

    await waitFor(() => expect(mockUseUserTableData).toHaveBeenLastCalledWith(
      ['accounts', 'table'],
      expect.objectContaining({ statuses: ['invited'] }),
      expect.any(Object),
    ));
  });

  it('shows the staff-scoped presentation without staff-management controls', async () => {
    mockUseAuth.mockReturnValue({ role: 'staff', permissions: ['read:accounts', 'write:accounts', 'write:youth_profiles'] });
    mockUseUserTableData.mockReturnValue({
      rows: [accounts[1]],
      loading: false,
      error: '',
    });

    renderPage();
    await screen.findByRole('button', { name: 'Filters' });
    expect(screen.queryByRole('button', { name: '+ Add', expanded: false })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.queryByRole('menuitem', { name: 'Role' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Status' })).toBeInTheDocument();
  });

  // Commands and dialogs.
  it('returns to the invitation draft with the saved school selected', async () => {
    mockUseAuth.mockReturnValue({ role: 'staff', permissions: ['read:accounts', 'write:youth_profiles', 'write:schools'] });
    renderPage();
    await screen.findByRole('button', { name: 'Filters' });
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));
    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'Unsaved youth' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'School' })).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: 'School' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '+ Add school' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Add School' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('School Name *'), { target: { value: 'New School' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByRole('dialog', { name: 'Invite Youth' });
    expect(screen.getByLabelText('First Name *')).toHaveValue('Unsaved youth');
    await waitFor(() => expect(screen.getByRole('button', { name: 'School' })).toHaveTextContent('Authoritative School'));
  });

  it('opens the account status confirmation from the table action', async () => {
    mockUseAuth.mockReturnValue({ role: 'admin', permissions: ['read:accounts', 'write:accounts'] });
    renderPage();
    await screen.findByRole('button', { name: 'Filters' });

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Alice Admin' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Deactivate' }));

    expect(screen.getByRole('heading', { name: 'Deactivate Account' })).toBeInTheDocument();
    expect(screen.getByText('Deactivate login access for Alice Admin?')).toBeInTheDocument();
  });
});
