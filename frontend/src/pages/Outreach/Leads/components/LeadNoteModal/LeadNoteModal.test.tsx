import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('adds a normalized follow-up note and returns the saved note to its owner', async () => {
    const onSaved = vi.fn();
    render(
      <LeadNoteModal
        lead={lead}
        note={null}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByLabelText('Follow-up note *'), {
      target: { value: '  Called and left a message.  ' },
    });
    fireEvent.submit(document.getElementById('lead-note-form')!);

    await waitFor(() => expect(api.setLeadNote).toHaveBeenCalledWith(
      lead.id,
      note.details,
    ));
    expect(onSaved).toHaveBeenCalledWith(note);
    expect(await screen.findByText('Follow-up note added.')).toBeInTheDocument();
  });

  it('initializes and updates the selected note', async () => {
    const updatedNote = { ...note, details: 'Meeting booked.' };
    api.setLeadNote.mockResolvedValue(updatedNote);
    const onSaved = vi.fn();
    render(
      <LeadNoteModal
        lead={lead}
        note={note}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(screen.getByLabelText('Follow-up note *')).toHaveValue(note.details);
    fireEvent.change(screen.getByLabelText('Follow-up note *'), {
      target: { value: updatedNote.details },
    });
    fireEvent.submit(document.getElementById('lead-note-form')!);

    await waitFor(() => expect(api.setLeadNote).toHaveBeenCalledWith(
      lead.id,
      updatedNote.details,
      note.id,
    ));
    expect(onSaved).toHaveBeenCalledWith(updatedNote);
    expect(await screen.findByText('Follow-up note updated.')).toBeInTheDocument();
  });

  it('reports save failures and keeps the editor open', async () => {
    api.setLeadNote.mockRejectedValue(new Error('Could not save note'));
    const onSaved = vi.fn();
    render(
      <LeadNoteModal
        lead={lead}
        note={null}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByLabelText('Follow-up note *'), {
      target: { value: 'Call again tomorrow.' },
    });
    fireEvent.submit(document.getElementById('lead-note-form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save note');
    expect(screen.getByRole('dialog', { name: 'Add Follow-up Note' })).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
