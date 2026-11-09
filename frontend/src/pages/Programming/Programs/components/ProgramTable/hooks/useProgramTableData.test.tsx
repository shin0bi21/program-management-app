import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { Program } from '../../../../../../common/features/programs/types';
import { getProgramList } from '../../../api/programs.api';
import useProgramTableData from './useProgramTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
vi.mock('../../../api/programs.api', () => ({ getProgramList: vi.fn() }));

const program: Program = {
  id: 'program-1', name: 'Skills', enrollmentRequired: true, minAge: null, maxAge: null,
  defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
};

beforeEach(() => { vi.clearAllMocks(); vi.mocked(getProgramList).mockResolvedValue({ rows: [program], nextCursor: null }); });

it('keys the assigned scope and forwards cancellation, page size, and cursor to the program adapter', async () => {
  const filters = { assignedOnly: true };
  const queryKey = ['programs', 'table'];
  renderHook(() => useProgramTableData(queryKey, filters));
  const options = vi.mocked(useInfiniteListQuery).mock.calls[0][0];
  const signal = new AbortController().signal;

  expect(options.queryKey).toEqual([...queryKey, filters]);

  expect(await options.queryFn({ signal, pageParam: null } as Parameters<typeof options.queryFn>[0])).toEqual({ rows: [program], nextCursor: null });
  await options.queryFn({ signal, pageParam: 'next-page' } as Parameters<typeof options.queryFn>[0]);

  expect(getProgramList).toHaveBeenNthCalledWith(1, filters,
    { key: 'name', direction: 'asc', limit: 50, cursor: undefined }, { signal });
  expect(getProgramList).toHaveBeenNthCalledWith(2, filters,
    { key: 'name', direction: 'asc', limit: 50, cursor: 'next-page' }, { signal });
});
