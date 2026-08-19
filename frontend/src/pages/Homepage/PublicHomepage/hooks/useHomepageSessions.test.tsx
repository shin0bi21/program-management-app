import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicHomepageSessions } from '../publicHomepage.api';
import { useHomepageSessions } from './useHomepageSessions';

vi.mock('../publicHomepage.api', () => ({ getPublicHomepageSessions: vi.fn() }));

const session = {
  id: 'session-1',
  cohortId: 'cohort-1',
  theme: 'Communication',
  description: null,
  startsAt: '2026-08-20T17:00:00.000Z',
  endsAt: '2026-08-20T19:00:00.000Z',
  cohortName: 'Summer 2026',
  programId: 'program-1',
  programName: 'Soft Skills',
  programDescription: null,
  rosterMode: 'enrolled' as const,
  minAge: 12,
  maxAge: 15,
  addedAt: '2026-01-01T00:00:00.000Z',
};

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('useHomepageSessions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes the public session query lifecycle and refresh action', async () => {
    vi.mocked(getPublicHomepageSessions).mockResolvedValue({ sessions: [session] });
    const { result } = renderHook(useHomepageSessions, { wrapper: createWrapper() });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.sessions).toEqual([session]));
    expect(result.current.error).toBeNull();

    await result.current.refresh();
    expect(getPublicHomepageSessions).toHaveBeenCalledTimes(2);
  });
});
