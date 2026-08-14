import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeYouthProfile } from '../../../tests/factories/youth';
import { getYouth } from '../../../common/features/youth/api/youth.api';
import { useYouth } from './useYouth';

vi.mock('../../../common/features/youth/api/youth.api', () => ({ getYouth: vi.fn() }));

const mockGetYouth = vi.mocked(getYouth);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useYouth', () => {
  beforeEach(() => {
    mockGetYouth.mockReset();
  });

  it('loads youth through the query cache', async () => {
    const youth = makeYouthProfile();
    mockGetYouth.mockResolvedValue([youth]);

    const { result } = renderHook(() => useYouth({ statuses: ['active'] }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.youth).toEqual([youth]);
    expect(mockGetYouth).toHaveBeenCalledWith(
      undefined,
      { statuses: ['active'] },
      { signal: expect.any(AbortSignal) },
      expect.objectContaining({ key: 'firstName', direction: 'asc', limit: 25 }),
    );
  });

});
