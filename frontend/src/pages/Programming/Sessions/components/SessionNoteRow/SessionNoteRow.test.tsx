import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SessionNote } from '../../types';
import SessionNoteRow from './SessionNoteRow';

const note: SessionNote = {
  id: 'note-1',
  sessionId: 'session-1',
  category: 'achievement',
  details: 'Led the opening activity.',
  createdAt: '2026-08-19T17:00:00.000Z',
  updatedAt: '2026-08-19T17:00:00.000Z',
  createdByName: 'Staff User',
  youth: [],
};

describe('SessionNoteRow', () => {
  it('maps session-note metadata and delegates the selected note', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<SessionNoteRow
      note={note}
      date={note.createdAt}
      onView={onView}
      onEdit={onEdit}
      onDelete={onDelete}
      deleteActionLabel="Unlink session note"
    />);

    expect(screen.getByText('Achievement')).toBeInTheDocument();
    expect(screen.queryByText(note.details)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View session note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit session note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unlink session note' }));

    expect(onView).toHaveBeenCalledWith(note);
    expect(onEdit).toHaveBeenCalledWith(note);
    expect(onDelete).toHaveBeenCalledWith(note);
  });
});
