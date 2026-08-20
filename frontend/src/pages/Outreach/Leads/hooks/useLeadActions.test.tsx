import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { deleteLead } from '../leads.api';
import type { Lead } from '../types';
import useLeadActions from './useLeadActions';

vi.mock('../leads.api', () => ({
  deleteLead: vi.fn(), updateLeadStatus: vi.fn(),
}));

const lead = {
  id: 'lead-1', youthFirstName: 'Avery', youthLastName: 'Outreach',
} as Lead;

beforeEach(() => vi.clearAllMocks());

it('owns confirmed deletion and list reconciliation', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useLeadActions(['leads', 'list']), { wrapper });

  act(() => result.current.requestDelete(lead));
  expect(result.current.confirmAction?.title).toBe('Delete Lead');
  await act(async () => result.current.confirmAction?.onConfirm());

  expect(deleteLead).toHaveBeenCalledWith('lead-1');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['leads', 'list'] });
});
