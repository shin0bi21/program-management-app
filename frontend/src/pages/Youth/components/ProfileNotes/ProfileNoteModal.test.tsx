import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setYouthProfileNote } from '../../youth.api';
import type { YouthProfileNote } from '../../types';
import ProfileNoteModal from './ProfileNoteModal';

vi.mock('../../youth.api', () => ({
  setYouthProfileNote: vi.fn(),
}));

describe('ProfileNoteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders and updates the shared category selector', () => {
    render(<ProfileNoteModal youthId="youth-1" onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Health' }));
    fireEvent.change(screen.getByLabelText('Note *'), { target: { value: 'Allergy plan' } });
    expect(screen.getByRole('button', { name: 'Category' })).toHaveTextContent('Health');
    expect(screen.getByLabelText('Note *')).toHaveValue('Allergy plan');
  });

  it('disables the complete form while a save is pending', async () => {
    let resolve!: (value: YouthProfileNote) => void;
    vi.mocked(setYouthProfileNote).mockReturnValue(new Promise(done => { resolve = done; }));
    render(<ProfileNoteModal youthId="youth-1" onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Note *'), { target: { value: 'Pending note' } });
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'General' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(setYouthProfileNote).toHaveBeenCalledOnce());

    expect(document.getElementById('profile-note-form')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Category' })).toBeDisabled();
    expect(screen.getByLabelText('Note *')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await act(async () => resolve({
      id: 'note-1',
      youthId: 'youth-1',
      category: 'general',
      details: 'Pending note',
      createdAt: '2026-08-19T12:00:00.000Z',
      updatedAt: '2026-08-19T12:00:00.000Z',
      createdByName: 'Admin User',
    }));
  });
});
