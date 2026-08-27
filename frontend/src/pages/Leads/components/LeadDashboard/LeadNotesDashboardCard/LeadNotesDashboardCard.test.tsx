// Owns Lead note dashboard rendering and representative save/delete integration wiring.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import type { Lead } from '../../../types';
import LeadNotesDashboardCard from './LeadNotesDashboardCard';

const api = vi.hoisted(() => ({
  getLeadNotes: vi.fn(),
  setLeadNote: vi.fn(),
  deleteLeadNote: vi.fn(),
}));

vi.mock('../../../leads.api', () => api);

const lead: Lead = {
  id: 'lead-1',
  origin: 'external',
  submittedByRole: 'guardian',
  convertedYouthId: null,
  youthFirstName: 'Avery',
  youthLastName: 'Outreach',
  age: 14,
  school: 'Test School',
  recommendedProgramId: null,
  recommendedProgramName: null,
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

describe('LeadNotesDashboardCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getLeadNotes.mockResolvedValue([existingNote]);
    api.setLeadNote.mockImplementation((_: string, details: string, noteId?: string) => Promise.resolve({
      ...existingNote,
      id: noteId ?? 'note-2',
      details,
    }));
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

    await waitFor(() => expect(api.setLeadNote).toHaveBeenCalledWith(
      lead.id,
      'Called again and booked a meeting.',
    ));
    expect(await screen.findByText('Called again and booked a meeting.')).toBeInTheDocument();
    expect(api.getLeadNotes).toHaveBeenCalledOnce();
  });

  it('deletes one cached note without refetching the collection', async () => {
    render(<LeadNotesDashboardCard lead={lead} canWrite />);
    await screen.findByText(existingNote.details);

    fireEvent.click(screen.getByRole('button', { name: `Delete ${existingNote.details}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.deleteLeadNote).toHaveBeenCalledWith(lead.id, existingNote.id));
    await waitFor(() => expect(screen.queryByText(existingNote.details)).not.toBeInTheDocument());
    expect(api.getLeadNotes).toHaveBeenCalledOnce();
  });

});
