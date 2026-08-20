// Owns Lead note field wiring and the rendered pending form state.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Lead, LeadNote } from '../../types';
import LeadNoteModal from './LeadNoteModal';

const api = vi.hoisted(() => ({
  setLeadNote: vi.fn(),
}));

vi.mock('../../leads.api', () => api);

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

describe('LeadNoteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.setLeadNote.mockResolvedValue(note);
  });

  it('renders the selected note in the edit form', () => {
    render(
      <LeadNoteModal
        lead={lead}
        note={note}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Edit Follow-up Note' })).toBeInTheDocument();
    expect(screen.getByLabelText('Follow-up note *')).toHaveValue(note.details);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('disables the complete form while a save is pending', async () => {
    api.setLeadNote.mockReturnValue(new Promise(() => undefined));
    render(
      <LeadNoteModal
        lead={lead}
        note={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Follow-up note *'), {
      target: { value: note.details },
    });
    fireEvent.submit(document.getElementById('lead-note-form')!);

    expect(await screen.findByText('Adding follow-up note...')).toBeInTheDocument();
    expect(document.getElementById('lead-note-form')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Follow-up note *')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add Note' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
