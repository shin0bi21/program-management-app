import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { getLeadNotes } from '../../../leads.api';
import type { Lead, LeadNote } from '../../../types';
import useLeadNotes from './useLeadNotes';

vi.mock('../../../leads.api', () => ({ getLeadNotes: vi.fn() }));

const lead = { id: 'lead-1', youthFirstName: 'Avery', youthLastName: 'Outreach' } as Lead;
const otherLead = { ...lead, id: 'lead-2', youthFirstName: 'Taylor' };
const note: LeadNote = {
  id: 'note-1', leadId: lead.id, category: 'follow_up', details: 'Called guardian.',
  createdAt: '2026-08-07T13:00:00.000Z', updatedAt: '2026-08-07T13:00:00.000Z',
  createdByName: 'Quinton Macnevin',
};

describe('useLeadNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLeadNotes).mockResolvedValue([note]);
  });

  it('loads the selected lead and clears opened details when selection changes', async () => {
    const { result, rerender } = renderHook(
      ({ selectedLead }: { selectedLead: Lead | null }) => useLeadNotes(selectedLead),
      { initialProps: { selectedLead: lead as Lead | null }, wrapper: createQueryClientWrapper(createTestQueryClient()) },
    );

    await waitFor(() => expect(result.current.notes).toEqual([note]));
    act(() => result.current.openDetails(note));
    expect(result.current.selectedNote).toEqual(note);

    vi.mocked(getLeadNotes).mockResolvedValue([]);
    rerender({ selectedLead: otherLead });

    await waitFor(() => expect(result.current.selectedNote).toBeNull());
    expect(getLeadNotes).toHaveBeenLastCalledWith(
      otherLead.id,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
