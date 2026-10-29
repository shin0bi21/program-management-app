import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import queryClient from '../query/queryClient';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './authContext';
import { STORAGE_KEYS, setAuthData } from './storage';
import { logout } from './auth.api';

vi.mock('./auth.api', () => ({ logout: vi.fn() }));

function resolveAfterDelay<T>(value: T, delayMs: number, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const handleAbort = () => {
      window.clearTimeout(timeoutId);
      reject(new DOMException('Aborted', 'AbortError'));
    };

    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort);
      resolve(value);
    }, delayMs);

    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

function PublicQueryProbe() {
  const query = useQuery({
    queryKey: ['public-query-probe'],
    queryFn: ({ signal }) => resolveAfterDelay('Public content loaded', 25, signal),
  });

  return <p>{query.data ?? 'Loading public content'}</p>;
}

function CurrentPathProbe() {
  const location = useLocation();
  return <p>Current path: {location.pathname}</p>;
}

function AuthProbe() {
  const auth = useAuth();

  return (
    <>
      <p>{auth.isAuthenticated ? 'Signed in' : 'Signed out'}</p>
      <p>Role: {auth.role ?? 'none'}</p>
      <p>Permissions: {auth.permissions.join(', ')}</p>
      <button onClick={() => void auth.logout()}>Sign out</button>
    </>
  );
}

function validStaffToken() {
  const payload = btoa(JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'staff',
    permissions: ['read:accounts'],
  }));
  return `header.${payload}.signature`;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
    vi.mocked(logout).mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('does not cancel public queries while initializing a signed-out visitor', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <PublicQueryProbe />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Public content loaded')).toBeInTheDocument();
  });

  it.each([
    ['successful server logout', false],
    ['rejected server logout', true],
  ])('clears the session and private cache after %s', async (_scenario, rejects) => {
    setAuthData(validStaffToken(), {
      id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com',
    });
    if (rejects) vi.mocked(logout).mockRejectedValue(new Error('network error'));
    else vi.mocked(logout).mockResolvedValue({});
    queryClient.setQueryData(['private', 'user-1'], 'private data');

    render(
      <MemoryRouter initialEntries={['/private']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AuthProbe />
          <CurrentPathProbe />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Signed in')).toBeInTheDocument();
    expect(screen.getByText('Role: staff')).toBeInTheDocument();
    expect(screen.getByText('Permissions: read:accounts')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(screen.getByText('Current path: /login')).toBeInTheDocument());
    expect(screen.getByText('Signed out')).toBeInTheDocument();
    expect(screen.getByText('Role: none')).toBeInTheDocument();
    expect(screen.getByText('Permissions:')).toBeInTheDocument();
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBeNull());
    expect(localStorage.getItem(STORAGE_KEYS.USER)).toBeNull();
    expect(queryClient.getQueryData(['private', 'user-1'])).toBeUndefined();
  });

  it('clears auth state, private cache, and navigates when the token is removed', async () => {
    setAuthData(validStaffToken(), {
      id: 'user-1', firstName: 'Test', lastName: 'User', email: 'test@example.com',
    });
    queryClient.setQueryData(['private', 'user-1'], 'private data');

    render(
      <MemoryRouter initialEntries={['/private']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AuthProbe />
          <CurrentPathProbe />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Signed in')).toBeInTheDocument();
    expect(screen.getByText('Role: staff')).toBeInTheDocument();
    expect(screen.getByText('Permissions: read:accounts')).toBeInTheDocument();
    act(() => {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.TOKEN, newValue: null }));
    });

    expect(await screen.findByText('Signed out')).toBeInTheDocument();
    expect(screen.getByText('Role: none')).toBeInTheDocument();
    expect(screen.getByText('Permissions:')).toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryData(['private', 'user-1'])).toBeUndefined());
    expect(screen.getByText('Current path: /login')).toBeInTheDocument();
  });
});
