import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import { getHoursTableData } from '../../../hours.api';
import useHoursTableData from './useHoursTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({
  default: vi.fn(() => ({ rows: [] })),
}));
vi.mock('../../../hours.api', () => ({ getHoursTableData: vi.fn() }));

const filters = {
  staffIds: ['staff-1'], categories: ['meeting' as const], programIds: ['program-1'],
  types: ['other' as const], cycleIds: ['cycle-1'], search: 'team',
};
const sorting = { key: 'date' as const, direction: 'desc' as const };

describe('useHoursTableData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes table controls to the query owner and forwards initial and next-page API inputs', async () => {
    renderHook(() => useHoursTableData(['hours', 'table'], filters, sorting));
    const options = vi.mocked(useInfiniteListQuery).mock.lastCall![0];
    const signal = new AbortController().signal;

    expect(options.queryKey).toEqual(['hours', 'table', filters, sorting]);
    await options.queryFn({ signal, pageParam: null } as Parameters<typeof options.queryFn>[0]);
    expect(getHoursTableData).toHaveBeenLastCalledWith(
      filters, { signal }, { ...sorting, cursor: undefined, limit: TABLE_PAGE_SIZE },
    );

    await options.queryFn({ signal, pageParam: 'cursor-2' } as Parameters<typeof options.queryFn>[0]);
    expect(getHoursTableData).toHaveBeenLastCalledWith(
      filters, { signal }, { ...sorting, cursor: 'cursor-2', limit: TABLE_PAGE_SIZE },
    );
  });

});
