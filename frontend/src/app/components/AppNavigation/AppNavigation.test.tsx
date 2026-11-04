import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AppNavigation from './AppNavigation';

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  permissions: [] as string[],
  role: 'youth',
  logout: vi.fn(),
}));

vi.mock('../../../auth/authContext', () => ({
  useAuth: () => ({
    isAuthenticated: authState.isAuthenticated,
    permissions: authState.permissions,
    role: authState.role,
    loading: false,
    login: vi.fn(),
    logout: authState.logout,
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
  beforeEach(() => {
    authState.isAuthenticated = true;
    authState.permissions = [];
    authState.role = 'youth';
    authState.logout.mockReset();
  });

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

    expect(screen.queryByRole('button', { name: 'Homepage' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Images' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Sign-up Form' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'My Account' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Youth' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Schools' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leads' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Users' })).not.toBeInTheDocument();
  });

  it.each([
    ['Images', '/homepage/images'],
    ['Sign-up Form', '/homepage/signup'],
  ])('opens %s from Homepage and closes the mobile sidebar', async (label, path) => {
    authState.permissions = ['read:homepage'];
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/settings/account']}>
        <AppNavigation />
        <CurrentPath />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Homepage' })).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('menuitem', { name: 'Manage Homepage' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('menuitem', { name: label }));

    expect(screen.getByTestId('current-path')).toHaveTextContent(path);
    expect(screen.getByRole('menuitem', { name: label })).toHaveClass('active');
    expect(document.querySelector('.sidebar')).not.toHaveClass('sidebar--open');
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

  it('opens Youth profiles directly and closes the mobile sidebar', async () => {
    authState.permissions = ['read:youth_profiles'];
    authState.role = 'staff';
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/settings/account']}>
        <AppNavigation />
        <CurrentPath />
      </MemoryRouter>,
    );

    const youth = screen.getByRole('button', { name: 'Youth' });
    expect(youth).not.toHaveAttribute('aria-haspopup');
    expect(screen.queryByRole('menuitem', { name: 'Profiles' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(youth);

    expect(screen.getByTestId('current-path')).toHaveTextContent('/youth/profiles');
    expect(youth).toHaveClass('active');
    expect(document.querySelector('.sidebar')).not.toHaveClass('sidebar--open');
  });

  it('opens Sessions from Programming and closes the mobile sidebar', async () => {
    authState.permissions = ['read:sessions'];
    authState.role = 'staff';
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/staff/hours']}>
        <AppNavigation />
        <CurrentPath />
      </MemoryRouter>,
    );

    const programming = screen.getByRole('button', { name: 'Programming' });
    expect(programming).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('menuitem', { name: 'Cohorts' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sessions' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Programs' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sessions' }));

    expect(screen.getByTestId('current-path')).toHaveTextContent('/programming/sessions');
    expect(programming).toHaveClass('active');
    expect(document.querySelector('.sidebar')).not.toHaveClass('sidebar--open');
  });

  it('shows Programs independently of session access', () => {
    authState.permissions = ['read:programs'];

    render(<MemoryRouter><AppNavigation /></MemoryRouter>);

    expect(screen.getByRole('button', { name: 'Programming' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Programs' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Sessions' })).not.toBeInTheDocument();
  });

  it('opens Programs from Programming', async () => {
    authState.permissions = ['read:programs', 'read:sessions', 'write:programs'];
    const user = userEvent.setup();

    render(<MemoryRouter><AppNavigation /><CurrentPath /></MemoryRouter>);

    const programs = screen.getByRole('menuitem', { name: 'Programs' });

    await user.click(programs);
    expect(screen.getByTestId('current-path')).toHaveTextContent('/programming/programs');
    expect(programs).toHaveClass('active');
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

  it('renders public login navigation and the authenticated logout action', async () => {
    const user = userEvent.setup();
    authState.isAuthenticated = false;
    const view = render(
      <MemoryRouter initialEntries={['/']}>
        <AppNavigation />
        <CurrentPath />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Login' }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/login');

    authState.isAuthenticated = true;
    view.rerender(
      <MemoryRouter initialEntries={['/']}>
        <AppNavigation />
        <CurrentPath />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Logout' }));
    expect(authState.logout).toHaveBeenCalledOnce();
  });

  it('opens and dismisses the mobile sidebar through its trigger and backdrop', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><AppNavigation /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('.sidebar')).toHaveClass('sidebar--open');

    await user.click(document.querySelector('.sidebar-backdrop') as HTMLElement);
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('.sidebar')).not.toHaveClass('sidebar--open');
  });
});
