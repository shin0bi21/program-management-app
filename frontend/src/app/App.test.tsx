import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const authState = vi.hoisted(() => ({
  permissions: [] as string[],
}));

vi.mock('../auth/authContext', () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false, permissions: authState.permissions }),
}));
vi.mock('../auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../auth/reauth/ReAuthProvider', () => ({
  ReAuthProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('./components/AppNavigation/AppNavigation', () => ({ default: () => null }));
vi.mock('../pages/Homepage/PublicHomepage/PublicHomepage', () => ({ default: () => <h1>Homepage</h1> }));
vi.mock('../pages/Programming/Sessions/Sessions', () => ({ default: () => <h1>Sessions</h1> }));

vi.mock('../pages/Programming/Programs/Programs', () => ({ default: () => <h1>Programs</h1> }));

vi.mock('../pages/Homepage/Images/Images', () => ({ default: () => <h1>Images</h1> }));
vi.mock('../pages/Homepage/SignupForm/SignupForm', () => ({ default: () => <h1>Sign-up Form</h1> }));

describe('Application routes', () => {
  beforeEach(() => {
    authState.permissions = ['read:sessions', 'read:programs', 'read:homepage'];
    window.history.replaceState(null, '', '/');
  });

  it('keeps the public Programming section available without session access', async () => {
    authState.permissions = [];
    window.history.replaceState(null, '', '/programming');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Homepage' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/programming');
  });

  it.each([
    ['/programming/calendar?sessionId=42&view=calendar', '/programming/sessions', 'Sessions'],
    ['/programming/cohorts?cohortId=7', '/programming/programs', 'Programs'],
    ['/settings/programming', '/programming/programs', 'Programs'],
    ['/homepage/manage', '/homepage/images', 'Images'],
  ])('preserves deep-link parameters when redirecting %s', async (path, destination, title) => {
    window.history.replaceState(null, '', path);

    render(<App />);

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(window.location.pathname).toBe(destination);
    expect(window.location.search).toBe(new URL(path, window.location.origin).search);
  });

  it.each([
    ['/programming/sessions', 'read:sessions', 'Sessions'],
    ['/programming/programs', 'read:programs', 'Programs'],
    ['/homepage/images', 'read:homepage', 'Images'],
    ['/homepage/signup', 'read:homepage', 'Sign-up Form'],
  ])('allows the matching reader to open %s', async (path, permission, title) => {
    authState.permissions = [permission];
    window.history.replaceState(null, '', path);

    render(<App />);

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument();
    expect(window.location.pathname).toBe(path);
  });

  it.each([
    ['/programming/sessions', 'read:programs'],
    ['/programming/calendar', 'read:programs'],
    ['/programming/programs', 'read:sessions'],
    ['/programming/cohorts', 'read:sessions'],
    ['/settings/programming', 'write:programs'],
    ['/homepage/images', 'write:homepage'],
    ['/homepage/signup', 'write:homepage'],
    ['/homepage/manage', 'read:accounts'],
  ])('requires the destination read permission through %s', async (path, permission) => {
    authState.permissions = [permission];
    window.history.replaceState(null, '', path);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Homepage' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
