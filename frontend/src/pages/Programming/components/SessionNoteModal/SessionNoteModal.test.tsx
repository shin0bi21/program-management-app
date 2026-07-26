import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagedSession } from '../../../../common/types/cohort';
import SessionNoteModal from './SessionNoteModal';

const api = vi.hoisted(() => ({
  createSessionNote: vi.fn(),
  getSessionRoster: vi.fn(),
}));

vi.mock('../../../../common/api/cohorts.api', () => ({
  createSessionNote: api.createSessionNote,
  getSessionRoster: api.getSessionRoster,
}));

const session: ManagedSession = {
  id: 'session-1',
  cohortId: 'cohort-1',
  theme: 'Communication',
  cohortName: 'Summer 2026',
  programId: 'program-1',
  programName: 'Soft Skills',
  rosterMode: 'enrolled',
  startsAt: '2026-07-28T21:00:00.000Z',
  endsAt: '2026-07-28T23:30:00.000Z',
  cancelledAt: null,
  description: 'Planned communication exercise',
  attendanceMarkedCount: 0,
  attendedCount: 0,
  attendanceRate: null,
  state: 'upcoming',
};

describe('SessionNoteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSessionRoster.mockResolvedValue([
      {
        youthId: 'youth-1',
        firstName: 'Maya',
        lastName: 'Thompson',
        status: null,
        notes: null,
      },
      {
        youthId: 'youth-2',
        firstName: 'Noah',
        lastName: 'Williams',
        status: null,
        notes: null,
      },
    ]);
    api.createSessionNote.mockResolvedValue({
      id: 'note-1',
      sessionId: session.id,
      note: 'Maya helped lead the group discussion.',
      createdAt: '2026-07-28T23:30:00.000Z',
      updatedAt: '2026-07-28T23:30:00.000Z',
      createdByName: 'Programming Demo',
      youth: [{ youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson' }],
    });
  });

  it('adds a note with optional cohort youth attachments', async () => {
    const onSaved = vi.fn();
    render(<SessionNoteModal session={session} onClose={vi.fn()} onSaved={onSaved} />);

    expect(await screen.findByText('Linked youth')).toBeInTheDocument();
    expect(screen.getByText(
      'Choose from youth enrolled in Soft Skills - Summer 2026.',
    )).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Session note' }), {
      target: { value: 'Maya helped lead the group discussion.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Link youth' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Maya Thompson' }));
    expect(screen.getByRole('button', { name: 'Remove Maya Thompson' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Note' }));

    await waitFor(() => expect(api.createSessionNote).toHaveBeenCalledWith('session-1', {
      note: 'Maya helped lead the group discussion.',
      youthIds: ['youth-1'],
    }));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(await screen.findByText('Session note successfully added.')).toBeInTheDocument();
  });

  it('keeps note submission available while the optional youth roster loads', () => {
    api.getSessionRoster.mockReturnValue(new Promise(() => {}));

    render(<SessionNoteModal session={session} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add Note' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Link youth' })).toBeDisabled();
    expect(screen.getByText('Loading youth...')).toBeInTheDocument();
  });
});
