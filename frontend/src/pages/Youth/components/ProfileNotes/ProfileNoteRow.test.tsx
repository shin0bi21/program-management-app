import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { YouthProfileNote } from '../../types';
import ProfileNoteRow from './ProfileNoteRow';

const note: YouthProfileNote = {
  id: 'note-1',
  youthId: 'youth-1',
  category: 'preference',
  details: 'Learning preferences',
  createdAt: '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
  createdByName: 'Admin User',
};

describe('ProfileNoteRow', () => {
  it('maps profile-note values and delegates the selected note', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<ProfileNoteRow note={note} onView={onView} onEdit={onEdit} onDelete={onDelete} />);

    expect(screen.queryByText('Learning preferences')).not.toBeInTheDocument();
    expect(screen.getByText('Preference')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View profile note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete profile note' }));

    expect(onView).toHaveBeenCalledWith(note);
    expect(onEdit).toHaveBeenCalledWith(note);
    expect(onDelete).toHaveBeenCalledWith(note);
  });

  it('does not expose management actions when the owner is read only', () => {
    render(<ProfileNoteRow note={note} onView={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'View profile note' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit profile note' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete profile note' })).not.toBeInTheDocument();
  });
});
