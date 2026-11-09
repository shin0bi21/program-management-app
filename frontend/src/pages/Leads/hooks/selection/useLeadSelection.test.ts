import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Lead } from '../../types';
import useLeadSelection from './useLeadSelection';

const lead = { id: 'lead-1', youthFirstName: 'Avery' } as Lead;

describe('useLeadSelection', () => {
  it('keeps clicked row context and updates or removes only the selected lead', () => {
    const { result } = renderHook(() => useLeadSelection());

    act(() => result.current.selectLead(lead));
    expect(result.current.selectedLead).toEqual(lead);
    expect(result.current.selectedLeadId).toBe(lead.id);

    act(() => result.current.updateSelectedLead({ ...lead, id: 'another-lead' }));
    expect(result.current.selectedLead).toEqual(lead);

    const savedLead = { ...lead, youthFirstName: 'Updated' };
    act(() => result.current.updateSelectedLead(savedLead));
    expect(result.current.selectedLead).toEqual(savedLead);

    act(() => result.current.removeSelectedLead('another-lead'));
    expect(result.current.selectedLeadId).toBe(lead.id);
    act(() => result.current.removeSelectedLead(lead.id));
    expect(result.current.selectedLead).toBeNull();
    expect(result.current.selectedLeadId).toBeNull();
  });
});
