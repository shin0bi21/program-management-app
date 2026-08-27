// Owns Lead note field wiring and the rendered pending form state.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Lead } from '../../types';
import LeadNoteModal from './LeadNoteModal';

const api = vi.hoisted(() => ({
  createLeadStatusNote: vi.fn(),
}));

vi.mock('../../leads.api', () => api);

const lead = {
  id: 'lead-1',
  youthFirstName: 'Avery',
  youthLastName: 'Outreach',
} as Lead;
const details = 'Called and left a message.';

describe('LeadNoteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.createLeadStatusNote.mockResolvedValue({ note: { details }, lead });
  });

  it('renders a preselected status update form', () => {
    render(
      <LeadNoteModal
        lead={lead}
        initialStatus="contacted"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Add Status Update' })).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toHaveTextContent('Contacted');
    expect(screen.getByLabelText('Note *')).toHaveValue('');
  });

  it('disables the complete form while a save is pending', async () => {
    api.createLeadStatusNote.mockReturnValue(new Promise(() => undefined));
    render(
      <LeadNoteModal
        lead={lead}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('Note *'), {
      target: { value: details },
    });
    fireEvent.submit(document.getElementById('lead-status-note-form')!);

    expect(await screen.findByText('Adding status update...')).toBeInTheDocument();
    expect(document.getElementById('lead-status-note-form')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Note *')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add Update' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
