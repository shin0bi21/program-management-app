import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSessions } from '../../../sessions.api';
import { makeCohortSession } from '../../../../../../tests/factories/session';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { useSessionTableData } from './useSessionTableData';

vi.mock('../../../sessions.api', () => ({ getSessions: vi.fn() }));

const session = makeCohortSession();

describe('useSessionTableData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends every table control through the cursor API', async () => {
    vi.mocked(getSessions).mockResolvedValue({ rows: [session], nextCursor: null });
    const client = createTestQueryClient();
    const filters = {
      programIds: ['program-1'], cycleIds: ['cycle-1', 'cycle-2'], sessionTypeIds: ['type-1'],
      statuses: ['upcoming' as const], search: 'communication',
    };
    const sorting = { key: 'date' as const, direction: 'desc' as const };
    const { result } = renderHook(
      () => useSessionTableData(['sessions', 'table'], filters, sorting),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.sessions).toEqual([session]));
    expect(getSessions).toHaveBeenCalledWith(
      filters,
      { signal: expect.any(AbortSignal) },
      { ...sorting, cursor: undefined, limit: 25 },
    );
  });

  it('forwards the server cursor when loading the next page', async () => {
    vi.mocked(getSessions).mockImplementation(async (_filters, _options, pagination) => (
      pagination.cursor
        ? { rows: [{ ...session, id: 'session-2' }], nextCursor: null }
        : { rows: [session], nextCursor: 'cursor-2' }
    ));
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useSessionTableData(['sessions', 'table'], {}, { key: 'date', direction: 'desc' }),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(getSessions).toHaveBeenLastCalledWith(
      expect.any(Object), { signal: expect.any(AbortSignal) }, expect.objectContaining({ cursor: 'cursor-2' }),
    ));
  });

  it('starts a fresh query when its base key, filters, or sorting changes', async () => {
    vi.mocked(getSessions).mockResolvedValue({ rows: [session], nextCursor: null });
    const client = createTestQueryClient();
    const initialProps = {
      queryKey: ['sessions', 'table', 'first'] as readonly unknown[],
      filters: { search: 'communication' } as Parameters<typeof useSessionTableData>[1],
      sorting: { key: 'date', direction: 'desc' } as Parameters<typeof useSessionTableData>[2],
    };
    const { rerender } = renderHook(
      ({ queryKey, filters, sorting }) => useSessionTableData(queryKey, filters, sorting),
      { initialProps, wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(getSessions).toHaveBeenCalledTimes(1));
    rerender({ ...initialProps, queryKey: ['sessions', 'table', 'second'] });
    await waitFor(() => expect(getSessions).toHaveBeenCalledTimes(2));
    rerender({ ...initialProps, queryKey: ['sessions', 'table', 'second'], filters: { search: 'career' } });
    await waitFor(() => expect(getSessions).toHaveBeenCalledTimes(3));
    rerender({
      ...initialProps,
      queryKey: ['sessions', 'table', 'second'],
      filters: { search: 'career' },
      sorting: { key: 'date', direction: 'asc' },
    });
    await waitFor(() => expect(getSessions).toHaveBeenCalledTimes(4));
  });
});
