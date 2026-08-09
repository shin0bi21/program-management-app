import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import queryClient from '../query/queryClient';
import { AuthProvider } from './AuthProvider';

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

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
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
});
