import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Lead } from '../../types';
import LeadNoteModal from './LeadNoteModal';

const api = vi.hoisted(() => ({
  createLeadNote: vi.fn(),
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
    api.createLeadNote.mockResolvedValue({ details });
  });

  it('disables the complete form while a save is pending', async () => {
    api.createLeadNote.mockReturnValue(new Promise(() => undefined));
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
    fireEvent.submit(document.getElementById('lead-note-form')!);

    expect(await screen.findByText('Adding follow-up note...')).toBeInTheDocument();
    expect(document.getElementById('lead-note-form')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Note *')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add Note' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
