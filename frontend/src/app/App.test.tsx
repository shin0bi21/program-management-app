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
vi.mock('../pages/Programming/Sessions/Sessions', () => ({ default: () => <h1>Programming</h1> }));

describe('Programming routes', () => {
  beforeEach(() => {
    authState.permissions = ['read:sessions', 'read:programs'];
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
    '/programming/sessions?sessionId=42&view=calendar',
    '/programming/cohorts?cohortId=7&view=calendar',
  ])('preserves deep-link parameters when redirecting %s', async (path) => {
    window.history.replaceState(null, '', path);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Programming' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/programming/calendar');
    expect(window.location.search).toBe(new URL(path, window.location.origin).search);
  });

  it('allows session readers to open the canonical screen without program lookup access', async () => {
    authState.permissions = ['read:sessions'];
    window.history.replaceState(null, '', '/programming/calendar');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Programming' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/programming/calendar');
  });

  it.each(['/programming/calendar', '/programming/cohorts'])('requires session read permission for the combined screen through %s', async (path) => {
    authState.permissions = ['read:programs'];
    window.history.replaceState(null, '', path);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Homepage' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
    expect(screen.queryByRole('heading', { name: 'Programming' })).not.toBeInTheDocument();
  });

  it('requires program lookup access on the old cohort route', async () => {
    authState.permissions = ['read:sessions'];
    window.history.replaceState(null, '', '/programming/cohorts');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Homepage' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });
});
