import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SessionNote } from '../../../../../common/types/cohort';
import SessionNoteCard from './SessionNoteCard';

const note = {
  id: 'note-1', sessionId: 'session-1', category: 'attendance', details: 'Arrived after check-in.',
  createdAt: '2026-08-19T17:00:00.000Z', updatedAt: '2026-08-19T17:00:00.000Z',
  createdByName: 'Staff User', youth: [],
} satisfies SessionNote;

describe('SessionNoteCard', () => {
  it('adapts the attendance actions without rendering the note body inline', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onUnlink = vi.fn();
    render(<SessionNoteCard note={note} onView={onView} onEdit={onEdit} onUnlink={onUnlink} />);

    expect(screen.queryByText(note.details)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View session note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit session note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unlink session note' }));

    expect(onView).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onUnlink).toHaveBeenCalledOnce();
  });
});
