import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import queryClient from '../queryClient';
import { AuthProvider } from './AuthContext';

function PublicQueryProbe() {
  const query = useQuery({
    queryKey: ['public-query-probe'],
    queryFn: ({ signal }) => new Promise<string>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => resolve('Public content loaded'), 25);
      signal.addEventListener('abort', () => {
        window.clearTimeout(timeoutId);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }),
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
