// Owns selected-lead synchronization after page actions.
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Lead } from '../../types';
import useLeadSelection from './useLeadSelection';

const lead = { id: 'lead-1', youthFirstName: 'Avery' } as Lead;

describe('useLeadSelection', () => {
  it('synchronizes and removes only the selected lead', () => {
    const { result } = renderHook(() => useLeadSelection());

    act(() => result.current.selectLead(lead));
    act(() => result.current.syncSelectedLead({ ...lead, youthFirstName: 'Updated' }));
    expect(result.current.selectedLead?.youthFirstName).toBe('Updated');

    act(() => result.current.removeSelectedLead('another-lead'));
    expect(result.current.selectedLeadId).toBe('lead-1');

    act(() => result.current.removeSelectedLead('lead-1'));
    expect(result.current.selectedLead).toBeNull();
  });
});
