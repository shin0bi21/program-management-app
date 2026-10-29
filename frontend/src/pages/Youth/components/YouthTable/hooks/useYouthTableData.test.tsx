import { createTestQueryClient, createQueryClientWrapper } from '../../../../../tests/queryClientTestUtils';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getYouth } from '../../../youth.api';
import { makeYouthProfile } from '../../../../../tests/factories/youth';
import useYouthTableData from './useYouthTableData';

vi.mock('../../../youth.api', () => ({ getYouth: vi.fn() }));

const mockGetYouth = vi.mocked(getYouth);

describe('useYouthTableData', () => {
  beforeEach(() => mockGetYouth.mockReset());

  it('loads youth through the canonical table query', async () => {
    const profile = makeYouthProfile();
    mockGetYouth.mockResolvedValue({ rows: [profile], nextCursor: null } as never);

    const { result } = renderHook(
      () => useYouthTableData(
        { cycleIds: ['cycle-1'] },
        { key: 'lastName', direction: 'desc' },
      ),
      { wrapper: createQueryClientWrapper(createTestQueryClient()) },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows).toEqual([profile]);
    expect(mockGetYouth).toHaveBeenCalledWith(
      undefined,
      { cycleIds: ['cycle-1'] },
      { signal: expect.any(AbortSignal) },
      expect.objectContaining({ key: 'lastName', direction: 'desc', limit: 25 }),
    );
  });
});
