import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AppNavigation from './AppNavigation';

const authState = vi.hoisted(() => ({
  permissions: [] as string[],
  role: 'youth',
}));

vi.mock('../../../auth/authContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    permissions: authState.permissions,
    role: authState.role,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../../../common/components/FloatingMenu/hooks/useFloatingMenu', () => ({
  useFloatingMenu: () => ({
    isOpen: true,
    toggle: vi.fn(),
    close: vi.fn(),
    position: { top: 0, left: 0 },
    menuRef: { current: null },
  }),
}));

function CurrentPath() {
  return <span data-testid="current-path">{useLocation().pathname}</span>;
}

describe('AppNavigation', () => {
  it('opens the public homepage when an authenticated user clicks the logo', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/settings/account']}>
        <AppNavigation />
        <CurrentPath />
      </MemoryRouter>,
    );

    const homepageButtons = screen.getAllByRole('button', { name: 'Go to homepage' });
    await user.click(homepageButtons[1]);

    expect(screen.getByTestId('current-path')).toHaveTextContent('/');
  });

  it('shows only My Account in application navigation for youth', () => {
    authState.permissions = [];
    authState.role = 'youth';
    render(
      <MemoryRouter>
        <AppNavigation />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('menuitem', { name: 'Manage Homepage' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'My Account' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Youth' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Schools' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leads' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Manage Accounts' })).not.toBeInTheDocument();
  });

  it('opens homepage management from Settings for staff with homepage access', () => {
    authState.permissions = ['read:homepage'];
    authState.role = 'staff';

    render(
      <MemoryRouter initialEntries={['/homepage/manage']}>
        <AppNavigation />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Homepage' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveClass('active');
    expect(screen.getByRole('menuitem', { name: 'Manage Homepage' })).toHaveClass('active');
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'My Account',
      'Manage Homepage',
    ]);
    expect(screen.queryByRole('menuitem', { name: 'Manage Accounts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Manage Programming' })).not.toBeInTheDocument();
  });

  it('shows Leads as top-level navigation for users with outreach access', () => {
    authState.permissions = ['read:outreach'];
    authState.role = 'staff';

    render(
      <MemoryRouter initialEntries={['/leads/external']}>
        <AppNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Leads' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'External Leads' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Internal Leads' })).toBeInTheDocument();
  });

  it('keeps the Youth navigation focused on profiles', () => {
    authState.permissions = ['read:youth_profiles'];
    authState.role = 'staff';

    render(
      <MemoryRouter initialEntries={['/youth/profiles']}>
        <AppNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Youth' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Profiles' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Attendance' })).not.toBeInTheDocument();
  });

  it('does not expose a standalone Schools destination', () => {
    authState.permissions = ['read:schools', 'write:schools'];
    authState.role = 'staff';

    render(
      <MemoryRouter>
        <AppNavigation />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Schools' })).not.toBeInTheDocument();
  });

  it('shows Cohorts and Sessions in Programming navigation', () => {
    authState.permissions = ['read:programs', 'read:cohorts', 'read:sessions'];
    authState.role = 'staff';

    render(
      <MemoryRouter initialEntries={['/programming/cohorts']}>
        <AppNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Programming' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Cohorts' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sessions' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Calendar' })).not.toBeInTheDocument();
  });

  it('places Programming before Leads in application navigation', () => {
    authState.permissions = [
      'read:programs',
      'read:cohorts',
      'read:sessions',
      'read:outreach',
    ];
    authState.role = 'staff';

    render(
      <MemoryRouter>
        <AppNavigation />
      </MemoryRouter>,
    );

    const programming = screen.getByRole('button', { name: 'Programming' });
    const leads = screen.getByRole('button', { name: 'Leads' });
    expect(
      programming.compareDocumentPosition(leads) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('places Staff before Youth in application navigation', () => {
    authState.permissions = ['read:hours', 'read:youth_profiles'];
    authState.role = 'staff';

    render(
      <MemoryRouter>
        <AppNavigation />
      </MemoryRouter>,
    );

    const staff = screen.getByRole('button', { name: 'Staff' });
    const youth = screen.getByRole('button', { name: 'Youth' });
    expect(staff.compareDocumentPosition(youth) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows each Staff destination only with its read permission', () => {
    authState.permissions = ['read:tasks'];
    authState.role = 'staff';

    const { rerender } = render(
      <MemoryRouter>
        <AppNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Tasks' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Hours' })).not.toBeInTheDocument();

    authState.permissions = ['read:hours'];
    rerender(
      <MemoryRouter>
        <AppNavigation />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('menuitem', { name: 'Tasks' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Hours' })).toBeInTheDocument();

    authState.permissions = [];
    rerender(
      <MemoryRouter>
        <AppNavigation />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Staff' })).not.toBeInTheDocument();
  });

  it('places Hours before Tasks in the Staff menu', () => {
    authState.permissions = ['read:hours', 'read:tasks'];
    authState.role = 'staff';

    render(
      <MemoryRouter>
        <AppNavigation />
      </MemoryRouter>,
    );

    const hours = screen.getByRole('menuitem', { name: 'Hours' });
    const tasks = screen.getByRole('menuitem', { name: 'Tasks' });
    expect(hours.compareDocumentPosition(tasks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('uses the canonical Hours URL from Staff navigation', async () => {
    authState.permissions = ['read:hours'];
    authState.role = 'staff';
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/staff/tasks']}>
        <AppNavigation />
        <CurrentPath />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('menuitem', { name: 'Hours' }));

    expect(screen.getByTestId('current-path')).toHaveTextContent('/staff/hours');
  });

  it('shows programming management in Settings only with program write access', () => {
    authState.permissions = ['write:programs'];
    authState.role = 'admin';
    const { rerender } = render(
      <MemoryRouter initialEntries={['/settings/programming']}>
        <AppNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole('menuitem', { name: 'Manage Programming' })).toHaveClass('active');

    authState.permissions = ['read:programs'];
    rerender(
      <MemoryRouter initialEntries={['/settings/account']}>
        <AppNavigation />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('menuitem', { name: 'Manage Programming' })).not.toBeInTheDocument();
  });

  it('orders admin Settings destinations by account, programming, then homepage management', () => {
    authState.permissions = ['read:accounts', 'write:programs', 'read:homepage'];
    authState.role = 'admin';
    render(
      <MemoryRouter>
        <AppNavigation />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'My Account',
      'Manage Accounts',
      'Manage Programming',
      'Manage Homepage',
    ]);
  });
});
