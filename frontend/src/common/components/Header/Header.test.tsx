import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Header from './Header';

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

vi.mock('../FloatingMenu/hooks/useFloatingMenu', () => ({
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

describe('Header youth navigation', () => {
  it('opens the public homepage when an authenticated user clicks the logo', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/settings/account']}>
        <Header />
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
        <Header />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('menuitem', { name: 'Manage Homepage' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'My Account' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Youth' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Schools' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Outreach' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Manage Accounts' })).not.toBeInTheDocument();
  });

  it('opens homepage management from Settings for staff with homepage access', () => {
    authState.permissions = ['read:homepage'];
    authState.role = 'staff';

    render(
      <MemoryRouter initialEntries={['/homepage/manage']}>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Homepage' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveClass('active');
    expect(screen.getByRole('menuitem', { name: 'Manage Homepage' })).toHaveClass('active');
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

  it('keeps the Youth navigation focused on profiles', () => {
    authState.permissions = ['read:youth_profiles'];
    authState.role = 'staff';

    render(
      <MemoryRouter initialEntries={['/youth/profiles']}>
        <Header />
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
        <Header />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: 'Schools' })).not.toBeInTheDocument();
  });

  it('shows Cohorts and Sessions in Programming navigation', () => {
    authState.permissions = ['read:programs', 'read:cohorts', 'read:sessions'];
    authState.role = 'staff';

    render(
      <MemoryRouter initialEntries={['/programming/cohorts']}>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Programming' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Cohorts' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sessions' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Calendar' })).not.toBeInTheDocument();
  });

  it('places Programming before Outreach in application navigation', () => {
    authState.permissions = [
      'read:programs',
      'read:cohorts',
      'read:sessions',
      'read:outreach',
    ];
    authState.role = 'staff';

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    );

    const programming = screen.getByRole('button', { name: 'Programming' });
    const outreach = screen.getByRole('button', { name: 'Outreach' });
    expect(
      programming.compareDocumentPosition(outreach) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
