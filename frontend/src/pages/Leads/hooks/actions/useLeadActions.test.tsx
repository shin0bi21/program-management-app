// Owns useLeadActions state transitions and observable effects.
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { deleteLead, updateLeadStatus } from '../../leads.api';
import type { Lead } from '../../types';
import useLeadActions from './useLeadActions';

vi.mock('../../leads.api', () => ({
  deleteLead: vi.fn(), updateLeadStatus: vi.fn(),
}));

const lead = {
  id: 'lead-1', youthFirstName: 'Avery', youthLastName: 'Outreach',
} as Lead;
const otherLead = {
  id: 'lead-2', youthFirstName: 'Sam', youthLastName: 'Stable',
} as Lead;
const tableKey = ['leads', 'external', 'table'] as const;

function seedVariant(client: QueryClient, suffix: string, rows: Lead[]) {
  const queryKey = [...tableKey, { search: suffix }];
  client.setQueryData(queryKey, {
    pages: [{ rows, nextCursor: null }],
    pageParams: [undefined],
  });
  return queryKey;
}

beforeEach(() => vi.clearAllMocks());

it('replaces an updated lead in every cached table variant without refetching', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
  const firstKey = seedVariant(client, 'first', [lead, otherLead]);
  const secondKey = seedVariant(client, 'second', [lead]);
  const cachedOtherLead = client.getQueryData<{ pages: { rows: Lead[] }[] }>(firstKey)?.pages[0].rows[1];
  const savedLead = { ...lead, status: 'eligible' } as Lead;
  vi.mocked(updateLeadStatus).mockResolvedValue(savedLead);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey }), { wrapper });

  await act(async () => result.current.setStatus(lead, 'eligible'));

  expect(updateLeadStatus).toHaveBeenCalledWith('lead-1', 'eligible');
  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(firstKey)?.pages[0].rows).toEqual([savedLead, otherLead]);
  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(firstKey)?.pages[0].rows[1]).toBe(cachedOtherLead);
  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(secondKey)?.pages[0].rows).toEqual([savedLead]);
  expect(invalidate).not.toHaveBeenCalled();
});

it('removes a confirmed lead from every cached table variant without refetching', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
  const firstKey = seedVariant(client, 'first', [lead, otherLead]);
  const secondKey = seedVariant(client, 'second', [lead]);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey }), { wrapper });

  act(() => result.current.requestDelete(lead));
  expect(result.current.confirmAction?.title).toBe('Delete Lead');
  await act(async () => result.current.confirmAction?.onConfirm());

  expect(deleteLead).toHaveBeenCalledWith('lead-1');
  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(firstKey)?.pages[0].rows).toEqual([otherLead]);
  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(secondKey)?.pages[0].rows).toEqual([]);
  expect(invalidate).not.toHaveBeenCalled();
});

it('replaces a signed-up lead while invalidating only its related owners', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
  const variantKey = seedVariant(client, 'signup', [lead, otherLead]);
  const signedUpLead = { ...lead, status: 'signed_up' } as Lead;
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey }), { wrapper });

  await act(async () => result.current.reconcileSignUp(signedUpLead));

  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(variantKey)?.pages[0].rows).toEqual([signedUpLead, otherLead]);
  expect(invalidate).toHaveBeenCalledTimes(2);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['youth'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['cohorts'] });
  expect(invalidate).not.toHaveBeenCalledWith({ queryKey: tableKey });
});

it('keeps the newest status response when concurrent requests resolve out of order', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const variantKey = seedVariant(client, 'overlap', [lead]);
  let resolveFirst!: (value: Lead) => void;
  let resolveSecond!: (value: Lead) => void;
  vi.mocked(updateLeadStatus)
    .mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve; }))
    .mockReturnValueOnce(new Promise(resolve => { resolveSecond = resolve; }));
  const onLeadSynced = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey, onLeadSynced }), { wrapper });

  let firstRequest!: Promise<void>;
  let secondRequest!: Promise<void>;
  act(() => {
    firstRequest = result.current.setStatus(lead, 'contacted');
    secondRequest = result.current.setStatus(lead, 'eligible');
  });
  const newestLead = { ...lead, status: 'eligible' } as Lead;
  await act(async () => {
    resolveSecond(newestLead);
    await secondRequest;
  });
  await act(async () => {
    resolveFirst({ ...lead, status: 'contacted' } as Lead);
    await firstRequest;
  });

  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(variantKey)?.pages[0].rows).toEqual([newestLead]);
  expect(onLeadSynced).toHaveBeenCalledOnce();
  expect(onLeadSynced).toHaveBeenCalledWith(newestLead);
  expect(result.current.actionError).toBe('');
});

it('keeps cached and selected state unchanged when the current status request fails', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const variantKey = seedVariant(client, 'failure', [lead]);
  const onLeadSynced = vi.fn();
  vi.mocked(updateLeadStatus).mockRejectedValue(new Error('network unavailable'));
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useLeadActions({ tableQueryKey: tableKey, onLeadSynced }), { wrapper });

  await act(async () => result.current.setStatus(lead, 'eligible'));

  expect(client.getQueryData<{ pages: { rows: Lead[] }[] }>(variantKey)?.pages[0].rows).toEqual([lead]);
  expect(onLeadSynced).not.toHaveBeenCalled();
  expect(result.current.actionError).toBe('Unable to update lead status.');
});
