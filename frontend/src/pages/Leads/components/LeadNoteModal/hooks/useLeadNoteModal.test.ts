// Owns Lead note draft reset, validation, command payloads, status, and retry behavior.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createLeadStatusNote } from '../../../leads.api';
import type { CreateLeadStatusNoteResult, Lead, LeadNote } from '../../../types';
import useLeadNoteModal from './useLeadNoteModal';

vi.mock('../../../leads.api', () => ({ createLeadStatusNote: vi.fn() }));

const lead = {
  id: 'lead-1',
  status: 'new',
  youthFirstName: 'Avery',
  youthLastName: 'Outreach',
} as Lead;
const note: LeadNote = {
  id: 'note-1',
  leadId: lead.id,
  category: 'contacted',
  details: 'Called and left a message.',
  createdAt: '2026-08-07T13:00:00.000Z',
  updatedAt: '2026-08-07T13:00:00.000Z',
  createdByName: 'Quinton Macnevin',
};
const savedResult: CreateLeadStatusNoteResult = { note, lead: { ...lead, status: 'contacted' } };

describe('useLeadNoteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createLeadStatusNote).mockResolvedValue(savedResult);
  });

  it('creates a normalized note and reports success', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useLeadNoteModal({
      lead,
      onSaved,
    }));

    act(() => result.current.updateDetails('  Called and left a message.  '));
    await act(() => result.current.submit());

    expect(createLeadStatusNote).toHaveBeenCalledWith(lead.id, 'new', note.details);
    expect(onSaved).toHaveBeenCalledWith(savedResult);
    expect(result.current.submitStatus).toBe('success');
    expect(result.current.statusMessage).toBe('Status updated.');
  });

  it('rejects a whitespace-only direct submission', async () => {
    const { result } = renderHook(() => useLeadNoteModal({
      lead,
      onSaved: vi.fn(),
    }));

    act(() => result.current.updateDetails('   '));
    await act(() => result.current.submit());

    expect(createLeadStatusNote).not.toHaveBeenCalled();
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Enter a status note.');
  });

  it('preserves the draft when equivalent target objects are recreated', () => {
    const onSaved = vi.fn();
    const view = renderHook(
      ({ currentLead }) => useLeadNoteModal({
        lead: currentLead,
        onSaved,
      }),
      { initialProps: { currentLead: lead } },
    );

    act(() => view.result.current.updateDetails('Draft in progress'));
    view.rerender({ currentLead: { ...lead } });

    expect(view.result.current.details).toBe('Draft in progress');
  });

  it('shows a save failure and permits a retry', async () => {
    vi.mocked(createLeadStatusNote)
      .mockRejectedValueOnce(new Error('Could not save note'))
      .mockResolvedValueOnce(savedResult);
    const onSaved = vi.fn();
    const { result } = renderHook(() => useLeadNoteModal({
      lead,
      onSaved,
    }));
    act(() => result.current.updateDetails(note.details));

    await act(() => result.current.submit());
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Could not save note');
    expect(onSaved).not.toHaveBeenCalled();

    await act(() => result.current.submit());
    expect(createLeadStatusNote).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledWith(savedResult);
    expect(result.current.submitStatus).toBe('success');
  });
});
