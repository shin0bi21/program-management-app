import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getLeads } from '../../../leads.api';
import type { Lead } from '../../../types';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { useLeads } from './useLeads';

vi.mock('../../../leads.api', () => ({ getLeads: vi.fn() }));

const lead: Lead = {
  id: 'lead-1', origin: 'internal', submittedByRole: 'staff', convertedYouthId: null,
  youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Test School',
  recommendedProgramId: 'program-1', recommendedProgramName: 'Soft Skills', contactPhoneNumber: '416-555-0142',
  contactRelationship: 'guardian', discoverySource: 'community_outreach', notes: null, status: 'new',
  statusUpdatedAt: '2026-08-01T12:00:00.000Z', createdAt: '2026-08-01T12:00:00.000Z',
};

describe('useLeads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('waits for initialized filters and then sends every list control', async () => {
    vi.mocked(getLeads).mockResolvedValue({ rows: [lead], nextCursor: null });
    const client = createTestQueryClient();
    const filters = { search: 'avery', statuses: ['new' as const], programIds: ['program-1'] };
    const sorting = { key: 'created' as const, direction: 'desc' as const };
    const { result, rerender } = renderHook(
      ({ readyFilters }: { readyFilters: typeof filters | null }) => (
        useLeads(['leads', 'list'], readyFilters, sorting)
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

  it('appends the next cursor page', async () => {
    vi.mocked(getLeads).mockImplementation(async (_filters, pagination) => (
      pagination?.cursor
        ? { rows: [{ ...lead, id: 'lead-2' }], nextCursor: null }
        : { rows: [lead], nextCursor: 'cursor-2' }
    ));
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useLeads(['leads', 'list'], {}, { key: 'created', direction: 'desc' }),
      { wrapper: createQueryClientWrapper(client) },
    );
    await waitFor(() => expect(result.current.leads).toEqual([lead]));
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.leads.map(item => item.id)).toEqual(['lead-1', 'lead-2']));
    expect(getLeads).toHaveBeenLastCalledWith(
      expect.any(Object), expect.objectContaining({ cursor: 'cursor-2' }), { signal: expect.any(AbortSignal) },
    );
  });
});
