// Owns Lead note draft reset, validation, command payloads, status, and retry behavior.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setLeadNote } from '../../../leads.api';
import type { Lead, LeadNote } from '../../../types';
import useLeadNoteModal from './useLeadNoteModal';

vi.mock('../../../leads.api', () => ({ setLeadNote: vi.fn() }));

const lead = {
  id: 'lead-1',
  youthFirstName: 'Avery',
  youthLastName: 'Outreach',
} as Lead;
const note: LeadNote = {
  id: 'note-1',
  leadId: lead.id,
  details: 'Called and left a message.',
  createdAt: '2026-08-07T13:00:00.000Z',
  updatedAt: '2026-08-07T13:00:00.000Z',
  createdByName: 'Quinton Macnevin',
};

describe('useLeadNoteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setLeadNote).mockResolvedValue(note);
  });

  it('creates a normalized note and reports success', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useLeadNoteModal({
      lead,
      note: null,
      onSaved,
    }));

    act(() => result.current.updateDetails('  Called and left a message.  '));
    await act(() => result.current.submit());

    expect(setLeadNote).toHaveBeenCalledWith(lead.id, note.details);
    expect(onSaved).toHaveBeenCalledWith(note);
    expect(result.current.submitStatus).toBe('success');
    expect(result.current.statusMessage).toBe('Follow-up note added.');
  });

  it('initializes and updates the selected note', async () => {
    const updatedNote = { ...note, details: 'Meeting booked.' };
    vi.mocked(setLeadNote).mockResolvedValue(updatedNote);
    const onSaved = vi.fn();
    const { result } = renderHook(() => useLeadNoteModal({ lead, note, onSaved }));

    expect(result.current.details).toBe(note.details);
    act(() => result.current.updateDetails(updatedNote.details));
    await act(() => result.current.submit());

    expect(setLeadNote).toHaveBeenCalledWith(lead.id, updatedNote.details, note.id);
    expect(onSaved).toHaveBeenCalledWith(updatedNote);
    expect(result.current.statusMessage).toBe('Follow-up note updated.');
  });

  it('rejects a whitespace-only direct submission', async () => {
    const { result } = renderHook(() => useLeadNoteModal({
      lead,
      note: null,
      onSaved: vi.fn(),
    }));

    act(() => result.current.updateDetails('   '));
    await act(() => result.current.submit());

    expect(setLeadNote).not.toHaveBeenCalled();
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Enter a follow-up note.');
  });

  it('preserves the draft when equivalent target objects are recreated', () => {
    const onSaved = vi.fn();
    const view = renderHook(
      ({ currentLead, currentNote }) => useLeadNoteModal({
        lead: currentLead,
        note: currentNote,
        onSaved,
      }),
      { initialProps: { currentLead: lead, currentNote: note } },
    );

    act(() => view.result.current.updateDetails('Draft in progress'));
    view.rerender({ currentLead: { ...lead }, currentNote: { ...note } });

    expect(view.result.current.details).toBe('Draft in progress');
  });

  it('shows a save failure and permits a retry', async () => {
    vi.mocked(setLeadNote)
      .mockRejectedValueOnce(new Error('Could not save note'))
      .mockResolvedValueOnce(note);
    const onSaved = vi.fn();
    const { result } = renderHook(() => useLeadNoteModal({
      lead,
      note: null,
      onSaved,
    }));
    act(() => result.current.updateDetails(note.details));

    await act(() => result.current.submit());
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.statusMessage).toBe('Could not save note');
    expect(onSaved).not.toHaveBeenCalled();

    await act(() => result.current.submit());
    expect(setLeadNote).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledWith(note);
    expect(result.current.submitStatus).toBe('success');
  });
});
