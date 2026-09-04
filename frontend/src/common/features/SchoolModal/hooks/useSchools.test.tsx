// Scope: verifies school loading and list-cache reconciliation.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { getSchools } from '../schoolModal.api';
import { useSchools } from './useSchools';

vi.mock('../schoolModal.api', () => ({ getSchools: vi.fn() }));

describe('useSchools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSchools).mockResolvedValue([{ id: 'school-1', name: 'Central High' }]);
  });

  it('loads schools and owns list-cache updates', async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useSchools(), {
      wrapper: createQueryClientWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.schools).toEqual([
      { id: 'school-1', name: 'Central High' },
    ]));
    expect(getSchools).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });

    act(() => result.current.upsertSchool({ id: 'school-2', name: 'West High' }));
    await waitFor(() => expect(result.current.schools).toHaveLength(2));

    act(() => result.current.removeSchool('school-1'));
    await waitFor(() => expect(result.current.schools).toEqual([
      { id: 'school-2', name: 'West High' },
    ]));
  });
});
