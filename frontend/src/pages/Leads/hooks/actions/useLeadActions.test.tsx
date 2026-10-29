import { createTestQueryClient, createQueryClientWrapper } from '../../../../tests/queryClientTestUtils';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { deleteLead, updateLeadStatus } from '../../leads.api';
import type { Lead } from '../../types';
import useLeadActions from './useLeadActions';

vi.mock('../../leads.api', () => ({ deleteLead: vi.fn(), updateLeadStatus: vi.fn() }));

const lead = { id: 'lead-1', youthFirstName: 'Avery', youthLastName: 'Outreach', status: 'new' } as Lead;
const otherLead = { id: 'lead-2', youthFirstName: 'Sam', youthLastName: 'Stable' } as Lead;
const tableKey = ['leads', 'external', 'table'] as const;

function seedVariant(client: QueryClient, rows: Lead[]) {
  const queryKey = [...tableKey, { search: 'variant' }];
  client.setQueryData(queryKey, { pages: [{ rows, nextCursor: null }], pageParams: [undefined] });
  return queryKey;
}

function setup() {
  const client = createTestQueryClient();
  const wrapper = createQueryClientWrapper(client);
  return { client, wrapper };
}

beforeEach(() => vi.clearAllMocks());

it('reconciles a direct status response across the lead table and selection', async () => {
  const { client, wrapper } = setup();
  const variantKey = seedVariant(client, [lead, otherLead]);
  const onLeadSynced = vi.fn();
  const savedLead = { ...lead, status: 'contacted' } as Lead;
  vi.mocked(updateLeadStatus).mockResolvedValue(savedLead);
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey, onLeadSynced }), { wrapper });

  await act(async () => result.current.setStatus(lead, 'contacted'));

  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(variantKey)?.pages[0].rows).toEqual([savedLead, otherLead]);
  expect(onLeadSynced).toHaveBeenCalledWith(savedLead);
  expect(updateLeadStatus).toHaveBeenCalledWith(lead.id, 'contacted');
});

it('removes a confirmed lead from cached table variants', async () => {
  const { client, wrapper } = setup();
  const variantKey = seedVariant(client, [lead, otherLead]);
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey }), { wrapper });

  act(() => result.current.requestDelete(lead));
  await act(async () => result.current.confirmAction?.onConfirm());

  expect(deleteLead).toHaveBeenCalledWith(lead.id);
  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(variantKey)?.pages[0].rows).toEqual([otherLead]);
});
