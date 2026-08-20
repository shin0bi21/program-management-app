import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLead } from '../../leads.api';
import type { Lead } from '../../types';
import { useLeadModal } from './useLeadModal';

vi.mock('../../leads.api', () => ({ createLead: vi.fn(), updateLead: vi.fn() }));

const values = {
  youthFirstName: ' Avery ',
  youthLastName: ' Outreach ',
  age: 14,
  school: ' Test School ',
  programId: 'program-1',
  contactPhoneNumber: ' 416-555-0142 ',
  contactRelationship: 'guardian' as const,
  discoverySource: 'online' as const,
  notes: ' Call next week. ',
};
const lead = {
  id: 'lead-1',
  youthFirstName: 'Avery',
  youthLastName: 'Outreach',
} as Lead;

describe('useLeadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes creation input and immediately reconciles the saved lead', async () => {
    vi.mocked(createLead).mockResolvedValue(lead);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useLeadModal({
      isOpen: true,
      onClose: vi.fn(),
      onSuccess,
    }));

    await act(() => result.current.onValid(values));

    expect(createLead).toHaveBeenCalledWith({
      youthFirstName: 'Avery',
      youthLastName: 'Outreach',
      age: 14,
      school: 'Test School',
      contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian',
      discoverySource: 'online',
      notes: 'Call next week.',
    });
    expect(result.current.submitStatus).toBe('success');
    expect(onSuccess).toHaveBeenCalledWith(lead);
  });

  it('reports request failures without reconciling the lead', async () => {
    vi.mocked(createLead).mockRejectedValue(new Error('Could not create lead'));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useLeadModal({
      isOpen: true,
      onClose: vi.fn(),
      onSuccess,
    }));

    await act(() => result.current.onValid(values));

    expect(result.current.submitStatus).toBe('error');
    expect(result.current.error).toBe('Could not create lead');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
