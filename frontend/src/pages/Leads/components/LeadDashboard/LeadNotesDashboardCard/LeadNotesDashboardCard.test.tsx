import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import type { Lead } from '../../../types';
import LeadNotesDashboardCard from './LeadNotesDashboardCard';

const api = vi.hoisted(() => ({
  getLeadNotes: vi.fn(),
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
  category: 'contacted' as const,
  details: 'Called and left a message.',
  createdAt: '2026-08-07T13:00:00.000Z',
  updatedAt: '2026-08-07T13:00:00.000Z',
  createdByName: 'Quinton Macnevin',
};

describe('LeadNotesDashboardCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getLeadNotes.mockResolvedValue([existingNote]);
  });

  it('shows status metadata only and opens full details', async () => {
    render(<LeadNotesDashboardCard lead={lead} canWrite onAddStatusUpdate={vi.fn()} />);

    expect(await screen.findByText('Contacted')).toBeInTheDocument();
    expect(screen.queryByText(existingNote.details)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View status update' }));
    expect(screen.getByRole('heading', { name: 'Status Update' })).toBeInTheDocument();
    expect(screen.getByText(existingNote.details)).toBeInTheDocument();
    expect(screen.getByText(/Quinton Macnevin/)).toBeInTheDocument();
  });

  it('delegates the standard add action and locks signed-up history', async () => {
    const onAddStatusUpdate = vi.fn();
    const view = render(<LeadNotesDashboardCard lead={lead} canWrite onAddStatusUpdate={onAddStatusUpdate} />);
    await screen.findByText('Contacted');
    fireEvent.click(screen.getByRole('button', { name: 'Add status update' }));
    expect(onAddStatusUpdate).toHaveBeenCalledWith(lead);

    view.rerender(<LeadNotesDashboardCard lead={{ ...lead, status: 'signed_up' }} canWrite onAddStatusUpdate={onAddStatusUpdate} />);
    expect(screen.getByRole('button', { name: 'Add status update' })).toBeDisabled();
  });

  it('labels uncategorized migrated notes as historical', async () => {
    api.getLeadNotes.mockResolvedValue([{ ...existingNote, category: null }]);
    render(<LeadNotesDashboardCard lead={lead} canWrite onAddStatusUpdate={vi.fn()} />);

    expect(await screen.findByText('Historical')).toBeInTheDocument();
  });
});
