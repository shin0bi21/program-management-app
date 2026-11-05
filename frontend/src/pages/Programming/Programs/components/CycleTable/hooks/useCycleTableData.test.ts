import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { getCycleList } from '../../../api/cycles.api';
import { CYCLE_TABLE_QUERY_KEY } from '../queryKeys';
import useCycleTableData from './useCycleTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
vi.mock('../../../api/cycles.api', () => ({ getCycleList: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('keys and gates the cycle list and forwards cancellation, page size, and cursor', async () => {
  const { rerender } = renderHook(({ enabled }) => useCycleTableData(enabled), {
    initialProps: { enabled: false },
  });
  const options = vi.mocked(useInfiniteListQuery).mock.calls[0][0];
  const signal = new AbortController().signal;

  expect(options.enabled).toBe(false);
  expect(options.queryKey).toEqual([...CYCLE_TABLE_QUERY_KEY, { key: 'startsOn', direction: 'desc' }]);
  rerender({ enabled: true });
  expect(vi.mocked(useInfiniteListQuery).mock.lastCall![0].enabled).toBe(true);

  await options.queryFn({ signal, pageParam: null } as Parameters<typeof options.queryFn>[0]);
  await options.queryFn({ signal, pageParam: 'next-page' } as Parameters<typeof options.queryFn>[0]);

  expect(getCycleList).toHaveBeenNthCalledWith(1,
    { key: 'startsOn', direction: 'desc', limit: 50, cursor: undefined }, { signal });
  expect(getCycleList).toHaveBeenNthCalledWith(2,
    { key: 'startsOn', direction: 'desc', limit: 50, cursor: 'next-page' }, { signal });
});
