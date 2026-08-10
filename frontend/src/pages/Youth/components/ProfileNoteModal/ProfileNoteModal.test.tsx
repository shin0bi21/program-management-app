import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createYouthProfileNote, updateYouthProfileNote } from '../../../../common/features/youth/api/youth.api';
import ProfileNoteModal from './ProfileNoteModal';

vi.mock('../../../../common/features/youth/api/youth.api', () => ({
  createYouthProfileNote: vi.fn(),
  updateYouthProfileNote: vi.fn(),
}));

describe('ProfileNoteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createYouthProfileNote).mockResolvedValue({
      id: 'note-1',
      youthId: 'youth-1',
      category: 'health',
      title: 'Allergy plan',
      details: null,
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      createdByName: 'Admin User',
    });
  });

  it('uses the shared category selector and submits its selected value', async () => {
    const onSaved = vi.fn();
    render(<ProfileNoteModal youthId="youth-1" onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole('button', { name: 'Type' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Health' }));
    fireEvent.change(screen.getByLabelText('Title *'), { target: { value: 'Allergy plan' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(createYouthProfileNote).toHaveBeenCalledWith('youth-1', {
      category: 'health',
      title: 'Allergy plan',
      details: null,
    }));
    expect(updateYouthProfileNote).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ category: 'health' }));
  });
});
