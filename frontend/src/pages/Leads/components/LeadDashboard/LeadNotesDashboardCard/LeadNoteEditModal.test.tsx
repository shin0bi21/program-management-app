// Owns details-only Lead status-note editing and immutable status presentation.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import LeadNoteEditModal from './LeadNoteEditModal';

const api = vi.hoisted(() => ({ updateLeadNote: vi.fn() }));
vi.mock('../../../leads.api', () => api);

const note = {
  id: 'note-1', leadId: 'lead-1', category: 'follow_up' as const,
  details: 'Called guardian.', createdAt: '2026-08-07T13:00:00.000Z',
  updatedAt: '2026-08-07T13:00:00.000Z', createdByName: 'Quinton Macnevin',
};

beforeEach(() => {
  vi.clearAllMocks();
  api.updateLeadNote.mockResolvedValue({ ...note, details: 'Reached guardian.' });
});

it('updates only normalized details and keeps the recorded status disabled', async () => {
  const onSaved = vi.fn();
  render(<LeadNoteEditModal note={note} onClose={vi.fn()} onSaved={onSaved} />);

  expect(screen.getByRole('button', { name: 'Category' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Note *' }), {
    target: { value: ' Reached guardian. ' },
  });
  fireEvent.submit(document.getElementById('lead-note-edit-form')!);

  await waitFor(() => expect(api.updateLeadNote).toHaveBeenCalledWith(note.leadId, note.id, 'Reached guardian.'));
  expect(onSaved).toHaveBeenCalledWith({ ...note, details: 'Reached guardian.' });
});
