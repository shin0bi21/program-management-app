// Owns lead cache reconciliation and destructive action coordination.
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { deleteLead } from '../../leads.api';
import type { Lead, LeadNote } from '../../types';
import useLeadActions from './useLeadActions';

vi.mock('../../leads.api', () => ({ deleteLead: vi.fn() }));

const lead = { id: 'lead-1', youthFirstName: 'Avery', youthLastName: 'Outreach', status: 'new' } as Lead;
const otherLead = { id: 'lead-2', youthFirstName: 'Sam', youthLastName: 'Stable' } as Lead;
const tableKey = ['leads', 'external', 'table'] as const;

function seedVariant(client: QueryClient, rows: Lead[]) {
  const queryKey = [...tableKey, { search: 'variant' }];
  client.setQueryData(queryKey, { pages: [{ rows, nextCursor: null }], pageParams: [undefined] });
  return queryKey;
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

beforeEach(() => vi.clearAllMocks());

it('reconciles a status note across the lead table, selection, and note query', async () => {
  const { client, wrapper } = setup();
  const variantKey = seedVariant(client, [lead, otherLead]);
  client.setQueryData(['leads', lead.id, 'notes'], []);
  const onLeadSynced = vi.fn();
  const savedLead = { ...lead, status: 'contacted' } as Lead;
  const note = { id: 'note-1', leadId: lead.id, category: 'contacted', details: 'Called mom.' } as LeadNote;
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey, onLeadSynced }), { wrapper });

  await act(async () => result.current.reconcileStatusNote({ lead: savedLead, note }));

  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(variantKey)?.pages[0].rows).toEqual([savedLead, otherLead]);
  expect(onLeadSynced).toHaveBeenCalledWith(savedLead);
  expect(client.getQueryState(['leads', lead.id, 'notes'])?.isInvalidated).toBe(true);
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
