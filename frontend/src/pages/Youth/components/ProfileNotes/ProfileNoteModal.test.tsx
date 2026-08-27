// Owns ProfileNoteModal field and submission-state wiring.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setYouthProfileNote } from '../../../../common/features/youth/youth.api';
import type { YouthProfileNote } from '../../../../common/types/youth';
import ProfileNoteModal from './ProfileNoteModal';

vi.mock('../../../../common/features/youth/youth.api', () => ({
  setYouthProfileNote: vi.fn(),
}));

describe('ProfileNoteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders and updates the shared category selector', () => {
    render(<ProfileNoteModal youthId="youth-1" onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Type' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Health' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Allergy plan' } });
    expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Health');
    expect(screen.getByLabelText('Title *')).toHaveValue('Allergy plan');
  });

  it('disables the complete form while a save is pending', async () => {
    let resolve!: (value: YouthProfileNote) => void;
    vi.mocked(setYouthProfileNote).mockReturnValue(new Promise(done => { resolve = done; }));
    render(<ProfileNoteModal youthId="youth-1" onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Pending note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(setYouthProfileNote).toHaveBeenCalledOnce());

    expect(document.getElementById('profile-note-form')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Type' })).toBeDisabled();
    expect(screen.getByLabelText('Title *')).toBeDisabled();
    expect(screen.getByLabelText('Details (optional)')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await act(async () => resolve({
      id: 'note-1',
      youthId: 'youth-1',
      category: 'general',
      title: 'Pending note',
      details: null,
      createdAt: '2026-08-19T12:00:00.000Z',
      updatedAt: '2026-08-19T12:00:00.000Z',
      createdByName: 'Admin User',
    }));
  });
});
