import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getExpressionsOfInterest } from '../expressionsOfInterest.api';
import type { ExpressionOfInterest } from '../types';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { useExpressionsOfInterest } from './useExpressionsOfInterest';

vi.mock('../expressionsOfInterest.api', () => ({ getExpressionsOfInterest: vi.fn() }));

const submission: ExpressionOfInterest = {
  id: 'expression-1', youthFirstName: 'Avery', youthLastName: 'Interest', contactPhoneNumber: '416-555-0100',
  contactRelationship: 'parent', age: 14, school: 'Test School', submittedByRole: 'parent',
  discoverySource: 'online', notes: null, status: 'new', createdAt: '2026-08-01T12:00:00.000Z',
  statusUpdatedAt: '2026-08-01T12:00:00.000Z', suggestedProgramId: 'program-1', suggestedProgramName: 'Soft Skills',
};

describe('useExpressionsOfInterest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('waits for initialized filters and sends every list control', async () => {
    vi.mocked(getExpressionsOfInterest).mockResolvedValue({ rows: [submission], nextCursor: null });
    const client = createTestQueryClient();
    const filters = { search: 'avery', statuses: ['new' as const], programIds: ['program-1'] };
    const sorting = { key: 'createdAt' as const, direction: 'desc' as const };
    const { result, rerender } = renderHook(
      ({ readyFilters }: { readyFilters: typeof filters | null }) => (
        useExpressionsOfInterest(['expressions-of-interest', 'list'], readyFilters, sorting)
      ),
      { initialProps: { readyFilters: null as typeof filters | null }, wrapper: createQueryClientWrapper(client) },
    );
    expect(getExpressionsOfInterest).not.toHaveBeenCalled();

    rerender({ readyFilters: filters });
    await waitFor(() => expect(result.current.submissions).toEqual([submission]));
    expect(getExpressionsOfInterest).toHaveBeenCalledWith(
      filters, { ...sorting, cursor: undefined, limit: 25 }, { signal: expect.any(AbortSignal) },
    );
  });

  it('appends the next cursor page', async () => {
    vi.mocked(getExpressionsOfInterest).mockImplementation(async (_filters, pagination) => (
      pagination.cursor
        ? { rows: [{ ...submission, id: 'expression-2' }], nextCursor: null }
        : { rows: [submission], nextCursor: 'cursor-2' }
    ));
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useExpressionsOfInterest(
        ['expressions-of-interest', 'list'], {}, { key: 'createdAt', direction: 'desc' },
      ),
      { wrapper: createQueryClientWrapper(client) },
    );
    await waitFor(() => expect(result.current.submissions).toEqual([submission]));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.submissions.map(item => item.id)).toEqual(['expression-1', 'expression-2']));
    expect(getExpressionsOfInterest).toHaveBeenLastCalledWith(
      expect.any(Object), expect.objectContaining({ cursor: 'cursor-2' }), { signal: expect.any(AbortSignal) },
    );
  });
});
