import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { getSessions } from '../../../sessions.api';
import { useSessionTableData } from './useSessionTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
vi.mock('../../../sessions.api', () => ({ getSessions: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('keys every session control and forwards cancellation, page size, and cursor', async () => {
  const queryKey = ['sessions', 'table'];
  const filters = {
    programIds: ['program-1'], cycleIds: ['cycle-1', 'cycle-2'], sessionTypes: ['Regular'],
    statuses: ['upcoming' as const], search: 'communication',
    dateRange: { start: '2026-01-01', end: '2026-12-31' },
  };
  const sorting = { key: 'date' as const, direction: 'desc' as const };
  const { rerender } = renderHook(({ enabled }) => useSessionTableData(queryKey, filters, sorting, enabled), {
    initialProps: { enabled: false },
  });
  const options = vi.mocked(useInfiniteListQuery).mock.calls[0][0];
  const signal = new AbortController().signal;

  expect(options.enabled).toBe(false);
  expect(options.queryKey).toEqual([...queryKey, filters, sorting]);
  rerender({ enabled: true });
  expect(vi.mocked(useInfiniteListQuery).mock.lastCall![0].enabled).toBe(true);

  await options.queryFn({ signal, pageParam: null } as Parameters<typeof options.queryFn>[0]);
  await options.queryFn({ signal, pageParam: 'cursor-2' } as Parameters<typeof options.queryFn>[0]);

  expect(getSessions).toHaveBeenNthCalledWith(1, filters, { signal },
    { ...sorting, cursor: undefined, limit: 50 });
  expect(getSessions).toHaveBeenNthCalledWith(2, filters, { signal },
    { ...sorting, cursor: 'cursor-2', limit: 50 });
});
