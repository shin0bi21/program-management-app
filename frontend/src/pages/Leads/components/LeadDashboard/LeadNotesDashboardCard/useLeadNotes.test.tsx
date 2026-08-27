// Owns selected-lead note loading, editor reset, and cache reconciliation.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { deleteLeadNote, getLeadNotes } from '../../../leads.api';
import type { Lead, LeadNote } from '../../../types';
import useLeadNotes from './useLeadNotes';

vi.mock('../../../leads.api', () => ({ deleteLeadNote: vi.fn(), getLeadNotes: vi.fn() }));

const lead = { id: 'lead-1', youthFirstName: 'Avery', youthLastName: 'Outreach' } as Lead;
const otherLead = { ...lead, id: 'lead-2', youthFirstName: 'Taylor' };
const note: LeadNote = {
  id: 'note-1',
  leadId: lead.id,
  details: 'Called guardian.',
  createdAt: '2026-08-07T13:00:00.000Z',
  updatedAt: '2026-08-07T13:00:00.000Z',
  createdByName: 'Quinton Macnevin',
};

describe('useLeadNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLeadNotes).mockResolvedValue([note]);
    vi.mocked(deleteLeadNote).mockResolvedValue({ success: true });
  });

  it('loads the selected lead and closes an editor when selection changes', async () => {
    const queryClient = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ selectedLead }: { selectedLead: Lead | null }) => useLeadNotes(selectedLead),
      {
        initialProps: { selectedLead: lead as Lead | null },
        wrapper: createQueryClientWrapper(queryClient),
      },
    );

    await waitFor(() => expect(result.current.notes).toEqual([note]));
    act(() => result.current.openEdit(note));
    expect(result.current.noteTarget?.note).toEqual(note);

    vi.mocked(getLeadNotes).mockResolvedValue([]);
    rerender({ selectedLead: otherLead });
    await waitFor(() => expect(result.current.noteTarget).toBeNull());
    expect(getLeadNotes).toHaveBeenLastCalledWith(
      otherLead.id,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('reconciles saves and deletes in the selected lead cache', async () => {
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useLeadNotes(lead), {
      wrapper: createQueryClientWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.notes).toEqual([note]));

    act(() => result.current.openCreate());
    const saved = { ...note, id: 'note-2', details: 'Meeting booked.' };
    act(() => result.current.reconcileSavedNote(saved));
    await waitFor(() => expect(result.current.notes).toEqual([saved, note]));

    const updated = { ...note, details: 'Follow-up scheduled.' };
    act(() => result.current.reconcileSavedNote(updated));
    await waitFor(() => expect(result.current.notes).toEqual([saved, updated]));

    act(() => result.current.requestDelete(note));
    await act(() => result.current.confirmAction!.onConfirm());
    await waitFor(() => expect(result.current.notes).toEqual([saved]));
    expect(deleteLeadNote).toHaveBeenCalledWith(lead.id, note.id);
  });
});
