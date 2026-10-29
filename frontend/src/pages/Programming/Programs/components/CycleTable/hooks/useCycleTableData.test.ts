import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { getCycleList } from '../../../api/cycles.api';
import useCycleTableData from './useCycleTableData';

vi.mock('../../../api/cycles.api', () => ({ getCycleList: vi.fn() }));

it('forwards cancellation and the next-page cursor to the cycle list adapter', async () => {
  vi.mocked(getCycleList).mockResolvedValueOnce({ rows: [], nextCursor: 'next-page' })
    .mockResolvedValueOnce({ rows: [], nextCursor: null });
  const { result } = renderHook(() => useCycleTableData(true), { wrapper: createQueryClientWrapper(createTestQueryClient()) });
  await waitFor(() => expect(result.current.hasNextPage).toBe(true));

  act(() => result.current.loadNextPage());

  await waitFor(() => expect(getCycleList).toHaveBeenLastCalledWith({ key: 'startsOn', direction: 'desc', limit: 50, cursor: 'next-page' }, { signal: expect.any(AbortSignal) }));
});
