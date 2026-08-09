import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import render from '../../../../tests/renderWithQueryClient';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import YouthAttendanceModal from './YouthAttendanceModal';

const api = vi.hoisted(() => ({
  getYouthCohortAttendance: vi.fn(),
  setYouthCohortAttendance: vi.fn(),
}));
const sessionNoteApi = vi.hoisted(() => ({
  createSessionNote: vi.fn(),
  getSessionRoster: vi.fn(),
  unlinkSessionNoteYouth: vi.fn(),
  updateSessionNote: vi.fn(),
}));

vi.mock('./youthAttendance.api', () => api);
vi.mock('../../../../common/features/programming/api/programming.api', () => sessionNoteApi);

const cohort = {
  id: 'cohort-1',
  name: 'Summer 2026',
  programId: 'program-1',
  programName: 'Soft Skills',
  rosterMode: 'enrolled' as const,
  startsOn: '2026-06-01',
  endsOn: '2026-08-31',
  enrolledOn: '2026-06-01',
  withdrawnOn: null,
  presentCount: 1,
  lateCount: 0,
  absentCount: 0,
  lastAttendedOn: '2026-07-14',
};

const attendance = {
  cohort: {
    id: cohort.id,
    name: cohort.name,
    programName: cohort.programName,
    rosterMode: cohort.rosterMode,
  },
  sessions: [
    {
      id: 'session-2', sessionTypeName: 'Workshop', theme: 'Teamwork',
      startsAt: '2026-07-21T21:00:00.000Z', endsAt: '2026-07-21T22:00:00.000Z',
      cancelledAt: null, status: null, notes: null, sessionNotes: [],
    },
    {
      id: 'session-1', sessionTypeName: 'Workshop', theme: 'Communication',
      startsAt: '2026-07-14T21:00:00.000Z', endsAt: '2026-07-14T22:00:00.000Z',
      cancelledAt: null, status: 'present' as const, notes: 'Participated fully',
      sessionNotes: [{
        id: 'note-1', sessionId: 'session-1', category: 'achievement' as const,
        title: 'Strong participation', details: 'Led the opening activity.',
        createdAt: '2026-07-14T22:00:00.000Z', updatedAt: '2026-07-14T22:00:00.000Z',
        createdByName: 'Bilal Khan',
        youth: [{ youthId: 'youth-1', firstName: 'Jamie', lastName: 'Test' }],
      }],
    },
  ],
};

describe('YouthAttendanceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getYouthCohortAttendance.mockResolvedValue(attendance);
    api.setYouthCohortAttendance.mockResolvedValue(attendance);
    sessionNoteApi.createSessionNote.mockResolvedValue({});
    sessionNoteApi.unlinkSessionNoteYouth.mockResolvedValue(undefined);
    sessionNoteApi.getSessionRoster.mockResolvedValue([
      { youthId: 'youth-1', firstName: 'Jamie', lastName: 'Test', status: 'present', notes: null },
    ]);
    sessionNoteApi.updateSessionNote.mockResolvedValue({});
  });

  it('shows each linked session note with its full details inline', async () => {
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1', cohorts: [cohort] })}
        cohort={cohort}
        canManageSessionNotes
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(await screen.findByText('Notes (1)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Strong participation' })).toBeInTheDocument();
    expect(screen.getByText('Achievement')).toBeInTheDocument();
    expect(screen.getByText('Led the opening activity.')).toBeInTheDocument();
    expect(screen.queryByText('Bilal Khan')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Strong participation' })).not.toBeInTheDocument();
    expect(screen.getByText('Notes (0)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Notes (0)' })).not.toBeInTheDocument();
    expect(screen.queryByText('No session notes linked to this youth.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide all notes' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Notes (1)' }));
    expect(screen.queryByText('Led the opening activity.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all notes' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Show all notes' }));
    expect(screen.getByText('Led the opening activity.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide all notes' }));
    expect(screen.queryByText('Led the opening activity.')).not.toBeInTheDocument();
  });

  it('adds a prelinked youth note without showing link controls and returns to attendance', async () => {
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1', cohorts: [cohort] })}
        cohort={cohort}
        canManageSessionNotes
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    const teamworkNotes = await screen.findByRole('region', { name: 'Notes for Teamwork' });
    fireEvent.click(within(teamworkNotes).getByRole('button', { name: '+ Add Note' }));
    expect(await screen.findByRole('heading', { name: 'Add Note' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Link youth' })).not.toBeInTheDocument();
    expect(sessionNoteApi.getSessionRoster).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Good teamwork' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Note' }));

    await waitFor(() => expect(sessionNoteApi.createSessionNote).toHaveBeenCalledWith(
      'session-2',
      expect.objectContaining({ title: 'Good teamwork', youthIds: ['youth-1'] }),
    ));
    expect(await screen.findByRole('heading', { name: 'Manage Attendance' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Add Note' })).not.toBeInTheDocument();
  });

  it('edits and unlinks session notes without deleting them', async () => {
    const view = render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1', cohorts: [cohort] })}
        cohort={cohort}
        canManageSessionNotes
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Strong participation' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), { target: { value: 'Updated participation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sessionNoteApi.updateSessionNote).toHaveBeenCalledWith(
      'session-1',
      'note-1',
      expect.objectContaining({ title: 'Updated participation', youthIds: ['youth-1'] }),
    ));

    view.unmount();
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1', cohorts: [cohort] })}
        cohort={cohort}
        canManageSessionNotes
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Unlink Strong participation' }));
    expect(screen.getByText(/The session note will remain available/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));
    await waitFor(() => expect(sessionNoteApi.unlinkSessionNoteYouth).toHaveBeenCalledWith(
      'session-1',
      'note-1',
      'youth-1',
    ));
  });

  it('loads every cohort session and saves statuses for only the selected youth', async () => {
    const onSaved = vi.fn();
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1', cohorts: [cohort] })}
        cohort={cohort}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(await screen.findByText('Teamwork')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(api.getYouthCohortAttendance).toHaveBeenCalledWith(
      'youth-1',
      'cohort-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Attendance for Teamwork/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Late' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Attendance' }));

    await waitFor(() => expect(api.setYouthCohortAttendance).toHaveBeenCalledWith(
      'youth-1',
      'cohort-1',
      [
        { sessionId: 'session-2', status: 'late', notes: null },
        { sessionId: 'session-1', status: 'present', notes: 'Participated fully' },
      ],
    ));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  });

  it('shows a load failure without enabling a destructive save', async () => {
    api.getYouthCohortAttendance.mockRejectedValue(new Error('Attendance unavailable'));
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1', cohorts: [cohort] })}
        cohort={cohort}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Attendance unavailable');
    expect(screen.getByRole('button', { name: 'Save Attendance' })).toBeDisabled();
  });
});
