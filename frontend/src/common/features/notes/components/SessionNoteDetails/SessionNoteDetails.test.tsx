// Owns session-note category mapping, linked-youth presentation, and optional context wiring.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SessionNote } from '../../../../types/cohort';
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
  it('maps the session category and renders every linked youth', () => {
    render(<SessionNoteDetails note={note} context={<span>Session context</span>} />);

    expect(screen.getByText('Achievement')).toHaveClass('note-category--achievement');
    expect(screen.getByText('Session context')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Linked youth' })).toBeInTheDocument();
    expect(screen.getByText('Maya Thompson')).toBeInTheDocument();
    expect(screen.getByText('Noah Williams')).toBeInTheDocument();
  });

  it('omits the linked-youth section when the note has no youth', () => {
    render(<SessionNoteDetails note={{ ...note, youth: [] }} />);

    expect(screen.queryByRole('heading', { name: 'Linked youth' })).not.toBeInTheDocument();
  });
});
