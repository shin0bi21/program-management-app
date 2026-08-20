// Scope: verifies Hours list request serialization and cursor accumulation.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTimeEntryList } from '../../../../../../common/features/timeEntries/timeEntries.api';
import { makeHoursItem } from '../../../../../../tests/factories/hours';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import useHoursList from './useHoursList';

vi.mock('../../../../../../common/features/timeEntries/timeEntries.api', () => ({
  getTimeEntryList: vi.fn(),
}));

const row = {
  id: 'entry-1',
  resourceId: 'staff-1',
  date: '2026-08-18',
  staffFirstName: 'Zoe',
  staffLastName: 'Wilson',
  staffName: 'Zoe Wilson',
  item: makeHoursItem({ id: 'entry-1', hours: 2 }),
};

describe('useHoursList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the complete list controls through the cursor API', async () => {
    vi.mocked(getTimeEntryList).mockResolvedValue({ rows: [row], nextCursor: null });
    const client = createTestQueryClient();
    const filters = {
      staffIds: ['staff-1'], categories: ['meeting' as const], programIds: ['program-1'],
      types: ['other' as const], cycleId: 'cycle-1', search: ' team ',
    };
    const sorting = { key: 'date' as const, direction: 'desc' as const };
    const { result } = renderHook(
      () => useHoursList(['time-entries', 'list'], filters, sorting),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.rows).toEqual([row]));
    expect(result.current.appliedSearch).toBe(' team ');
    expect(getTimeEntryList).toHaveBeenCalledWith(
      { ...filters, search: ' team ' },
      { signal: expect.any(AbortSignal) },
      { ...sorting, cursor: undefined, limit: 25 },
    );
  });

  it('loads the next cursor without replacing the first page', async () => {
    vi.mocked(getTimeEntryList).mockImplementation(async (_filters, _options, pagination) => (
      pagination.cursor
        ? { rows: [{ ...row, id: 'entry-2' }], nextCursor: null }
        : { rows: [row], nextCursor: 'cursor-2' }
    ));
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useHoursList(
        ['time-entries', 'list'],
        { staffIds: [], categories: [], programIds: [], types: [], search: '' },
        { key: 'date', direction: 'desc' },
      ),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.rows).toEqual([row]));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.rows.map(item => item.id)).toEqual(['entry-1', 'entry-2']));
    expect(getTimeEntryList).toHaveBeenLastCalledWith(
      expect.any(Object),
      { signal: expect.any(AbortSignal) },
      expect.objectContaining({ cursor: 'cursor-2' }),
    );
  });
});
