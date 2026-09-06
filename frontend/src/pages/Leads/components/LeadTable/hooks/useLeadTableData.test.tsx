import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getLeads } from '../../../leads.api';
import type { Lead } from '../../../types';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { useLeadTableData } from './useLeadTableData';

vi.mock('../../../leads.api', () => ({ getLeads: vi.fn() }));

const lead: Lead = {
  id: 'lead-1', origin: 'internal', submittedByRole: 'staff', convertedYouthId: null,
  youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Test School',
  recommendedProgramId: 'program-1', recommendedProgramName: 'Future Ready', contactPhoneNumber: '416-555-0142',
  contactRelationship: 'guardian', discoverySource: 'community_outreach', notes: null, status: 'new',
  statusUpdatedAt: '2026-08-01T12:00:00.000Z', createdAt: '2026-08-01T12:00:00.000Z',
};

describe('useLeadTableData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('waits for initialized filters and then sends every table control', async () => {
    vi.mocked(getLeads).mockResolvedValue({ rows: [lead], nextCursor: null });
    const client = createTestQueryClient();
    const filters = { search: 'avery', statuses: ['new' as const], programIds: ['program-1'] };
    const sorting = { key: 'created' as const, direction: 'desc' as const };
    const { result, rerender } = renderHook(
      ({ readyFilters }: { readyFilters: typeof filters | null }) => (
        useLeadTableData(['leads', 'table'], readyFilters, sorting)
      ),
      { initialProps: { readyFilters: null as typeof filters | null }, wrapper: createQueryClientWrapper(client) },
    );
    expect(getLeads).not.toHaveBeenCalled();

    rerender({ readyFilters: filters });
    await waitFor(() => expect(result.current.leads).toEqual([lead]));
    expect(getLeads).toHaveBeenCalledWith(
      filters, { ...sorting, cursor: undefined, limit: 25 }, { signal: expect.any(AbortSignal) },
    );
  });

  it('forwards the server cursor when loading the next page', async () => {
    vi.mocked(getLeads).mockImplementation(async (_filters, pagination) => (
      pagination?.cursor
        ? { rows: [{ ...lead, id: 'lead-2' }], nextCursor: null }
        : { rows: [lead], nextCursor: 'cursor-2' }
    ));
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useLeadTableData(['leads', 'table'], {}, { key: 'created', direction: 'desc' }),
      { wrapper: createQueryClientWrapper(client) },
    );
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(getLeads).toHaveBeenLastCalledWith(
      expect.any(Object), expect.objectContaining({ cursor: 'cursor-2' }), { signal: expect.any(AbortSignal) },
    ));
  });

  it('starts a fresh query when its base key, filters, or sorting changes', async () => {
    vi.mocked(getLeads).mockResolvedValue({ rows: [lead], nextCursor: null });
    const client = createTestQueryClient();
    const initialProps = {
      queryKey: ['leads', 'table', 'first'] as readonly unknown[],
      filters: { search: 'avery' } as Parameters<typeof useLeadTableData>[1],
      sorting: { key: 'created', direction: 'desc' } as Parameters<typeof useLeadTableData>[2],
    };
    const { rerender } = renderHook(
      ({ queryKey, filters, sorting }) => useLeadTableData(queryKey, filters, sorting),
      { initialProps, wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(getLeads).toHaveBeenCalledTimes(1));
    rerender({ ...initialProps, queryKey: ['leads', 'table', 'second'] });
    await waitFor(() => expect(getLeads).toHaveBeenCalledTimes(2));
    rerender({ ...initialProps, queryKey: ['leads', 'table', 'second'], filters: { search: 'new' } });
    await waitFor(() => expect(getLeads).toHaveBeenCalledTimes(3));
    rerender({
      ...initialProps,
      queryKey: ['leads', 'table', 'second'],
      filters: { search: 'new' },
      sorting: { key: 'created', direction: 'asc' },
    });
    await waitFor(() => expect(getLeads).toHaveBeenCalledTimes(4));
  });
});
