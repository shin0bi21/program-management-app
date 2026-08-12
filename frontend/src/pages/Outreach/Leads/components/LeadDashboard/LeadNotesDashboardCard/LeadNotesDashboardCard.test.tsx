import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import render from '../../../../../../tests/renderWithQueryClient';
import type { Lead } from '../../../types';
import LeadNotesDashboardCard from './LeadNotesDashboardCard';

const api = vi.hoisted(() => ({
  getLeadNotes: vi.fn(),
  createLeadNote: vi.fn(),
  updateLeadNote: vi.fn(),
  deleteLeadNote: vi.fn(),
}));

vi.mock('../../../api/leads.api', () => api);

const lead: Lead = {
  id: 'lead-1',
  origin: 'expression_of_interest',
  expressionOfInterestId: 'expression-1',
  convertedYouthId: null,
  youthFirstName: 'Avery',
  youthLastName: 'Outreach',
  age: 14,
  school: 'Test School',
  programOfInterestId: null,
  programOfInterestName: null,
  contactPhoneNumber: '519-555-0100',
  contactRelationship: 'guardian',
  discoverySource: 'online',
  notes: null,
  status: 'new',
  statusUpdatedAt: '2026-08-07T12:00:00.000Z',
  createdAt: '2026-08-07T12:00:00.000Z',
};

const existingNote = {
  id: 'note-1',
  leadId: lead.id,
  details: 'Called and left a message.',
  createdAt: '2026-08-07T13:00:00.000Z',
  updatedAt: '2026-08-07T13:00:00.000Z',
  createdByName: 'Quinton Macnevin',
};

const otherLead: Lead = {
  ...lead,
  id: 'lead-2',
  expressionOfInterestId: 'expression-2',
  youthFirstName: 'Taylor',
};

function LeadNotesSelectionHarness() {
  const [selectedLead, setSelectedLead] = useState(lead);
  return <>
    <button onClick={() => setSelectedLead(otherLead)}>Select Taylor</button>
    <LeadNotesDashboardCard lead={selectedLead} canWrite />
  </>;
}

describe('LeadNotesDashboardCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getLeadNotes.mockResolvedValue([existingNote]);
    api.createLeadNote.mockResolvedValue({
      ...existingNote,
      id: 'note-2',
      details: 'Called again and booked a meeting.',
    });
    api.updateLeadNote.mockResolvedValue({
      ...existingNote,
      details: 'Called and booked a meeting.',
    });
    api.deleteLeadNote.mockResolvedValue({ success: true });
  });

  it('shows authored follow-up history and adds another entry', async () => {
    render(<LeadNotesDashboardCard lead={lead} canWrite />);

    expect(await screen.findByText('Called and left a message.')).toBeInTheDocument();
    expect(screen.getByText(/Quinton Macnevin/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add follow-up note' }));
    fireEvent.change(screen.getByLabelText('Follow-up note *'), {
      target: { value: 'Called again and booked a meeting.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Note' }));

    await waitFor(() => expect(api.createLeadNote).toHaveBeenCalledWith(
      lead.id,
      'Called again and booked a meeting.',
    ));
    expect(await screen.findByText('Called again and booked a meeting.')).toBeInTheDocument();
    expect(api.getLeadNotes).toHaveBeenCalledOnce();
  });

  it('updates one cached note without refetching the collection', async () => {
    render(<LeadNotesDashboardCard lead={lead} canWrite />);
    await screen.findByText(existingNote.details);

    fireEvent.click(screen.getByRole('button', { name: /Edit follow-up note/ }));
    fireEvent.change(screen.getByLabelText('Follow-up note *'), {
      target: { value: 'Called and booked a meeting.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.updateLeadNote).toHaveBeenCalledWith(
      lead.id,
      existingNote.id,
      'Called and booked a meeting.',
    ));
    expect(await screen.findByText('Called and booked a meeting.')).toBeInTheDocument();
    expect(api.getLeadNotes).toHaveBeenCalledOnce();
  });

  it('deletes one cached note without refetching the collection', async () => {
    render(<LeadNotesDashboardCard lead={lead} canWrite />);
    await screen.findByText(existingNote.details);

    fireEvent.click(screen.getByRole('button', { name: /Delete follow-up note/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.deleteLeadNote).toHaveBeenCalledWith(lead.id, existingNote.id));
    await waitFor(() => expect(screen.queryByText(existingNote.details)).not.toBeInTheDocument());
    expect(api.getLeadNotes).toHaveBeenCalledOnce();
  });

  it('closes an editor instead of carrying its note into a newly selected lead', async () => {
    render(<LeadNotesSelectionHarness />);
    await screen.findByText(existingNote.details);

    fireEvent.click(screen.getByRole('button', { name: /Edit follow-up note/ }));
    expect(screen.getByRole('dialog', { name: 'Edit Follow-up Note' })).toBeInTheDocument();

    api.getLeadNotes.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: 'Select Taylor' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit Follow-up Note' })).not.toBeInTheDocument());
    expect(api.updateLeadNote).not.toHaveBeenCalled();
    expect(api.getLeadNotes).toHaveBeenLastCalledWith(otherLead.id, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
});
