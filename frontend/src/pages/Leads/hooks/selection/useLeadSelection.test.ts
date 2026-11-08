import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { leadData } from '../data/useLeadData';
import type { Lead } from '../../types';
import useLeadSelection from './useLeadSelection';

const lead = { id: 'lead-1', youthFirstName: 'Avery' } as Lead;

describe('useLeadSelection', () => {
  it('resolves current saved records and releases deleted or cleared account records', async () => {
    const client = createTestQueryClient();
    leadData.write(client, lead);
    const { result, rerender } = renderHook(() => useLeadSelection(leadData.useRecords()), { wrapper: createQueryClientWrapper(client) });

    act(() => result.current.selectLead(lead));
    act(() => leadData.write(client, { ...lead, youthFirstName: 'Updated' }));
    await waitFor(() => expect(result.current.selectedLead?.youthFirstName).toBe('Updated'));

    act(() => result.current.removeSelectedLead('another-lead'));
    expect(result.current.selectedLeadId).toBe('lead-1');

    act(() => leadData.remove(client, lead.id));
    await waitFor(() => expect(result.current.selectedLead).toBeNull());

    act(() => leadData.write(client, lead));
    act(() => result.current.selectLead(lead));
    await waitFor(() => expect(result.current.selectedLead).toEqual(lead));
    act(() => client.clear());
    rerender();
    expect(leadData.get(client, lead.id)).toBeUndefined();
    expect(result.current.selectedLead).toBeNull();
    expect(result.current.selectedLeadId).toBeNull();
  });
});
