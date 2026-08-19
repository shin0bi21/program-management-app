// Scope: verifies session-type loading and request cancellation wiring.
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSessionTypes } from '../../../../common/features/programming/api/sessions.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { useSessionTypes } from './useSessionTypes';

vi.mock('../../../../common/features/programming/api/sessions.api', () => ({ getSessionTypes: vi.fn() }));

describe('useSessionTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionTypes).mockResolvedValue([{
      id: 'type-1',
      name: 'Regular',
    }]);
  });

  it('loads session types with query cancellation support', async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useSessionTypes(), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    await waitFor(() => expect(result.current).toEqual([
      expect.objectContaining({ name: 'Regular' }),
    ]));
    expect(getSessionTypes).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
  });
});
