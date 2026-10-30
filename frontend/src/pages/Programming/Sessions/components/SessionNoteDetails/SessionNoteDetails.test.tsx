import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SessionNote } from '../../types';
import SessionNoteDetails from './SessionNoteDetails';

const note: SessionNote = {
  id: 'note-1',
  sessionId: 'session-1',
  category: 'achievement',
  details: 'Led the opening activity.',
  createdAt: '2026-08-19T17:00:00.000Z',
  updatedAt: '2026-08-19T17:00:00.000Z',
  createdByName: 'Staff User',
  youth: [
    { youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson' },
    { youthId: 'youth-2', firstName: 'Noah', lastName: 'Williams' },
  ],
};

describe('SessionNoteDetails', () => {
  it('shows the linked youth for a session note', () => {
    render(<SessionNoteDetails note={note} />);

    expect(screen.getByRole('heading', { name: 'Linked youth' })).toBeInTheDocument();
    expect(screen.getByText('Maya Thompson')).toBeInTheDocument();
    expect(screen.getByText('Noah Williams')).toBeInTheDocument();
  });

  it('omits the linked-youth section when the note has no youth', () => {
    render(<SessionNoteDetails note={{ ...note, youth: [] }} />);

    expect(screen.queryByRole('heading', { name: 'Linked youth' })).not.toBeInTheDocument();
  });
});
