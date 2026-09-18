import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicHomepagePrograms } from '../publicHomepage.api';
import { useHomepagePrograms } from './useHomepagePrograms';

vi.mock('../publicHomepage.api', () => ({ getPublicHomepagePrograms: vi.fn() }));

const program = {
  id: 'program-1',
  name: 'Future Ready',
  description: 'Build confidence and communication skills.',
  rosterMode: 'enrolled' as const,
  minAge: 12,
  maxAge: 15,
  sessions: [{
    id: 'session-1',
    theme: 'Communication',
    startsAt: '2026-08-20T17:00:00.000Z',
  }],
};

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('useHomepagePrograms', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes the public program query lifecycle and refresh action', async () => {
    vi.mocked(getPublicHomepagePrograms).mockResolvedValue({ programs: [program] });
    const { result } = renderHook(useHomepagePrograms, { wrapper: createWrapper() });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.programs).toEqual([program]));
    expect(result.current.error).toBeNull();

    await result.current.refresh();
    expect(getPublicHomepagePrograms).toHaveBeenCalledTimes(2);
  });
});
