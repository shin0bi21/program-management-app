import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSessionTypes } from '../../sessions.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { useSessionTypes } from './useSessionTypes';

vi.mock('../../sessions.api', () => ({ getSessionTypes: vi.fn() }));

describe('useSessionTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionTypes).mockResolvedValue([{
      id: 'Regular',
      name: 'Regular',
    }]);
  });

  it('loads session types with query cancellation support', async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useSessionTypes(), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.sessionTypes).toEqual([
      expect.objectContaining({ name: 'Regular' }),
    ]));
    expect(result.current).toMatchObject({ loading: false, error: null });
    expect(getSessionTypes).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
  });
});
