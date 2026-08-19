import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLead, updateLead } from '../../leads.api';
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
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it('normalizes creation input and completes after the success delay', async () => {
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
      programOfInterestId: 'program-1',
      contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian',
      discoverySource: 'online',
      notes: 'Call next week.',
    });
    expect(result.current.submitStatus).toBe('success');
    expect(onSuccess).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(800));
    expect(onSuccess).toHaveBeenCalledWith(lead);
  });

  it('cancels delayed completion when the modal closes', async () => {
    vi.mocked(updateLead).mockResolvedValue(lead);
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useLeadModal({
      isOpen: true,
      lead,
      onClose,
      onSuccess,
    }));

    await act(() => result.current.onValid(values));
    act(() => result.current.handleClose());
    act(() => vi.runAllTimers());

    expect(updateLead).toHaveBeenCalledWith('lead-1', expect.any(Object));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('reports request failures without scheduling completion', async () => {
    vi.mocked(createLead).mockRejectedValue(new Error('Could not create lead'));
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useLeadModal({
      isOpen: true,
      onClose: vi.fn(),
      onSuccess,
    }));

    await act(() => result.current.onValid(values));
    act(() => vi.runAllTimers());

    expect(result.current.submitStatus).toBe('error');
    expect(result.current.error).toBe('Could not create lead');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
