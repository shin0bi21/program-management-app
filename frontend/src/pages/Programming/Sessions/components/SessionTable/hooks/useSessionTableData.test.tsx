// Scope: verifies session table filter serialization and cursor-page accumulation.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSessions } from '../../../../../../common/features/programming/api/sessions.api';
import { makeCohortSession } from '../../../../../../tests/factories/session';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { useSessionTableData } from './useSessionTableData';

vi.mock('../../../../../../common/features/programming/api/sessions.api', () => ({ getSessions: vi.fn() }));

const session = makeCohortSession();

describe('useSessionTableData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends every table control through the cursor API', async () => {
    vi.mocked(getSessions).mockResolvedValue({ rows: [session], nextCursor: null });
    const client = createTestQueryClient();
    const filters = {
      programIds: ['program-1'], cohortId: 'cohort-1', sessionTypeIds: ['type-1'],
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

  it('appends the next cursor page', async () => {
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

    await waitFor(() => expect(result.current.sessions).toEqual([session]));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.sessions.map(item => item.id)).toEqual(['session-1', 'session-2']));
    expect(getSessions).toHaveBeenLastCalledWith(
      expect.any(Object), { signal: expect.any(AbortSignal) }, expect.objectContaining({ cursor: 'cursor-2' }),
    );
  });
});
