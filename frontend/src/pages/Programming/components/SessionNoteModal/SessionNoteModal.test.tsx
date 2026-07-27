import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagedSession } from '../../../../common/types/cohort';
import SessionNoteModal from './SessionNoteModal';

const api = vi.hoisted(() => ({
  createSessionNote: vi.fn(),
  getSessionRoster: vi.fn(),
  updateSessionNote: vi.fn(),
}));

vi.mock('../../../../common/api/cohorts.api', () => ({
  createSessionNote: api.createSessionNote,
  getSessionRoster: api.getSessionRoster,
  updateSessionNote: api.updateSessionNote,
}));

const session: ManagedSession = {
  id: 'session-1',
  cohortId: 'cohort-1',
  sessionTypeId: 'type-regular',
  sessionTypeName: 'Regular',
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
      category: 'behaviour',
      title: 'Group leadership',
      details: 'Maya helped lead the group discussion.',
      createdAt: '2026-07-28T23:30:00.000Z',
      updatedAt: '2026-07-28T23:30:00.000Z',
      createdByName: 'Programming Demo',
      youth: [{ youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson' }],
    });
    api.updateSessionNote.mockResolvedValue({});
  });

  it('adds a note with optional cohort youth attachments', async () => {
    const onSaved = vi.fn();
    render(<SessionNoteModal session={session} onClose={vi.fn()} onSaved={onSaved} />);

    expect(await screen.findByRole('group', { name: 'Link youth' })).toBeInTheDocument();
    expect(screen.queryByText(/Choose from youth/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Behaviour' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Group leadership' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Details (optional)' }), {
      target: { value: 'Maya helped lead the group discussion.' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Maya Thompson' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Noah Williams' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Note' }));

    await waitFor(() => expect(api.createSessionNote).toHaveBeenCalledWith('session-1', {
      category: 'behaviour',
      title: 'Group leadership',
      details: 'Maya helped lead the group discussion.',
      youthIds: ['youth-1', 'youth-2'],
    }));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(await screen.findByText('Session note successfully added.')).toBeInTheDocument();
  });

  it('keeps note submission available while the optional youth roster loads', () => {
    api.getSessionRoster.mockReturnValue(new Promise(() => {}));

    render(<SessionNoteModal session={session} onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Add Note' })).toBeEnabled();
    expect(screen.getByRole('group', { name: 'Link youth' })).toBeInTheDocument();
    expect(screen.getByText('Loading youth…')).toBeInTheDocument();
  });

  it('adds a note without optional details', async () => {
    render(<SessionNoteModal session={session} onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Attendance follow-up' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Note' }));

    await waitFor(() => expect(api.createSessionNote).toHaveBeenCalledWith('session-1', {
      category: 'general',
      title: 'Attendance follow-up',
      details: null,
      youthIds: [],
    }));
  });

  it('edits the note fields and linked youth', async () => {
    const onSaved = vi.fn();
    render(
      <SessionNoteModal
        session={session}
        note={{
          id: 'note-1',
          sessionId: session.id,
          category: 'achievement',
          title: 'Original title',
          details: 'Original details.',
          createdAt: '2026-07-28T23:30:00.000Z',
          updatedAt: '2026-07-28T23:30:00.000Z',
          createdByName: 'Programming Demo',
          youth: [{ youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson' }],
        }}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit Note' })).toBeInTheDocument();
    expect(await screen.findByRole('checkbox', { name: 'Maya Thompson' })).toBeChecked();
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
      target: { value: 'Updated title' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Details (optional)' }), {
      target: { value: 'Updated details.' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Noah Williams' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.updateSessionNote).toHaveBeenCalledWith(
      'session-1',
      'note-1',
      {
        category: 'achievement',
        title: 'Updated title',
        details: 'Updated details.',
        youthIds: ['youth-1', 'youth-2'],
      },
    ));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(await screen.findByText('Session note successfully updated.')).toBeInTheDocument();
  });
});
