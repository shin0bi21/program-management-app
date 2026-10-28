import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import type { Lead } from '../../../types';
import LeadNotesDashboardCard from './LeadNotesDashboardCard';

const api = vi.hoisted(() => ({
  getLeadNotes: vi.fn(),
  updateLeadNote: vi.fn(),
  createLeadNote: vi.fn(),
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
  age: 14, dateOfBirth: `${new Date().getFullYear() - 14}-01-01`,
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
  category: 'follow_up' as const,
  details: 'Called and left a message.',
  createdAt: '2026-08-07T13:00:00.000Z',
  updatedAt: '2026-08-07T13:00:00.000Z',
  createdByName: 'Quinton Macnevin',
};

describe('LeadNotesDashboardCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getLeadNotes.mockResolvedValue([existingNote]);
    api.updateLeadNote.mockResolvedValue({ ...existingNote, details: 'Reached guardian.' });
  });

  it('edits note details without offering category changes', async () => {
    render(<LeadNotesDashboardCard lead={lead} canWrite />);

    await screen.findByText('Follow-up');
    expect(screen.getByRole('button', { name: 'Delete follow-up note' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit follow-up note' }));
    expect(screen.getByRole('button', { name: 'Category' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Note *' }), { target: { value: ' Reached guardian. ' } });
    fireEvent.submit(document.getElementById('lead-note-edit-form')!);

    await waitFor(() => expect(api.updateLeadNote).toHaveBeenCalledWith(lead.id, existingNote.id, 'Reached guardian.'));
  });

  it('confirms deletion and removes the note from the card count', async () => {
    api.deleteLeadNote.mockResolvedValue({ id: existingNote.id });
    render(<LeadNotesDashboardCard lead={lead} canWrite />);

    await screen.findByText('Notes (1)');
    fireEvent.click(screen.getByRole('button', { name: 'Delete follow-up note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(api.deleteLeadNote).toHaveBeenCalledWith(lead.id, existingNote.id));
    expect(await screen.findByText('Notes (0)')).toBeInTheDocument();
  });

  it('shows status metadata only and opens full details', async () => {
    render(<LeadNotesDashboardCard lead={lead} canWrite />);

    expect(await screen.findByText('Follow-up')).toBeInTheDocument();
    expect(screen.queryByText(existingNote.details)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View follow-up note' }));
    expect(screen.getByRole('heading', { name: 'Follow-up Note' })).toBeInTheDocument();
    expect(screen.getByText(existingNote.details)).toBeInTheDocument();
  });

  it('opens the follow-up note form for signed-up leads', async () => {
    render(<LeadNotesDashboardCard lead={{ ...lead, status: 'signed_up' }} canWrite />);
    await screen.findByText('Follow-up');
    fireEvent.click(screen.getByRole('button', { name: 'Add follow-up note' }));
    expect(screen.getByRole('dialog', { name: 'Add Follow-up Note' })).toBeInTheDocument();
  });
});
