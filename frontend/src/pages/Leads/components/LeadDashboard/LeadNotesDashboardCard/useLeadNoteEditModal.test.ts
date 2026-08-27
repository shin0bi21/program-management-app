// Owns Lead-note edit draft normalization, command payload, and validation.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { updateLeadNote } from '../../../leads.api';
import type { LeadNote } from '../../../types';
import useLeadNoteEditModal from './useLeadNoteEditModal';

vi.mock('../../../leads.api', () => ({ updateLeadNote: vi.fn() }));

const note = {
  id: 'note-1', leadId: 'lead-1', category: 'follow_up', details: 'Called guardian.',
  createdAt: '2026-08-07T13:00:00.000Z', updatedAt: '2026-08-07T13:00:00.000Z',
  createdByName: 'Quinton Macnevin',
} as LeadNote;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(updateLeadNote).mockResolvedValue({ ...note, details: 'Reached guardian.' });
});

it('saves normalized details without a mutable status field', async () => {
  const onSaved = vi.fn();
  const { result } = renderHook(() => useLeadNoteEditModal({ note, onSaved }));

  act(() => result.current.updateDetails(' Reached guardian. '));
  await act(() => result.current.submit());

  expect(updateLeadNote).toHaveBeenCalledWith(note.leadId, note.id, 'Reached guardian.');
  expect(onSaved).toHaveBeenCalledWith({ ...note, details: 'Reached guardian.' });
});
