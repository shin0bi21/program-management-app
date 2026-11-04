import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient as render } from '../../../../tests/queryClientTestUtils';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import YouthAttendanceModal from './YouthAttendanceModal';

const api = vi.hoisted(() => ({
  getYouthProgramCycleAttendance: vi.fn(),
  setYouthProgramCycleAttendance: vi.fn(),
}));
const sessionNoteApi = vi.hoisted(() => ({
  createSessionNote: vi.fn(),
  getSessionRoster: vi.fn(),
  unlinkSessionNoteYouth: vi.fn(),
  updateSessionNote: vi.fn(),
}));

vi.mock('./youthAttendance.api', () => api);
vi.mock('../../../Programming/Sessions/sessions.api', () => sessionNoteApi);

const programCycle = {
  cycleId: 'cycle-1',
  cycleName: 'Summer 2026',
  programId: 'program-1',
  programName: 'Soft Skills',
  enrollmentRequired: true,
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
  programCycle: {
    programId: programCycle.programId,
    cycleId: programCycle.cycleId,
    cycleName: programCycle.cycleName,
    programName: programCycle.programName,
    enrollmentRequired: programCycle.enrollmentRequired,
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
        details: 'Led the opening activity.',
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
    api.getYouthProgramCycleAttendance.mockResolvedValue(attendance);
    api.setYouthProgramCycleAttendance.mockResolvedValue({ ...attendance, youth: makeYouthProfile() });
    sessionNoteApi.createSessionNote.mockResolvedValue({});
    sessionNoteApi.unlinkSessionNoteYouth.mockResolvedValue(undefined);
    sessionNoteApi.getSessionRoster.mockResolvedValue([
      { youthId: 'youth-1', firstName: 'Jamie', lastName: 'Test', status: 'present', notes: null },
    ]);
    sessionNoteApi.updateSessionNote.mockResolvedValue({});
  });

  it('shows note metadata in the row and full details on demand', async () => {
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1', programCycles: [programCycle] })}
        programCycle={programCycle}
        canManageSessionNotes
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(await screen.findByText('Notes (1)')).toBeInTheDocument();
    expect(screen.queryByText('Led the opening activity.')).not.toBeInTheDocument();
    expect(screen.queryByText('Bilal Khan')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View session note' }));
    const detailsDialog = screen.getByRole('dialog', { name: 'Session Note' });
    expect(screen.getByText('Led the opening activity.')).toBeInTheDocument();
    fireEvent.click(within(detailsDialog).getByText('Close'));
    expect(screen.getByText('Notes (0)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Notes (0)' })).not.toBeInTheDocument();
    expect(screen.queryByText('No session notes linked to this youth.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide all notes' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Notes (1)' }));
    expect(screen.queryByText('Led the opening activity.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show all notes' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Show all notes' }));
    expect(screen.getByRole('button', { name: 'View session note' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide all notes' }));
    expect(screen.queryByRole('button', { name: 'View session note' })).not.toBeInTheDocument();
  });

  it('adds a prelinked youth note without showing link controls', async () => {
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1', programCycles: [programCycle] })}
        programCycle={programCycle}
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
    fireEvent.change(screen.getByRole('textbox', { name: 'Note *' }), { target: { value: 'Good teamwork' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sessionNoteApi.createSessionNote).toHaveBeenCalledWith(
      'session-2',
      expect.objectContaining({ details: 'Good teamwork', youthIds: ['youth-1'] }),
    ));
    expect(screen.getByText('Session note successfully added.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add Note' })).toBeInTheDocument();
  });

  it('edits and unlinks session notes without deleting them', async () => {
    const view = render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1', programCycles: [programCycle] })}
        programCycle={programCycle}
        canManageSessionNotes
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Edit session note' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Note *' }), { target: { value: 'Updated participation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sessionNoteApi.updateSessionNote).toHaveBeenCalledWith(
      'session-1',
      'note-1',
      expect.objectContaining({ details: 'Updated participation', youthIds: ['youth-1'] }),
    ));

    view.unmount();
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1', programCycles: [programCycle] })}
        programCycle={programCycle}
        canManageSessionNotes
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Unlink session note' }));
    expect(screen.getByText(/The session note will remain available/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(sessionNoteApi.unlinkSessionNoteYouth).toHaveBeenCalledWith(
      'session-1',
      'note-1',
      'youth-1',
    ));
  });

  it('loads every programCycle session and saves statuses for only the selected youth', async () => {
    const onSaved = vi.fn();
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1', programCycles: [programCycle] })}
        programCycle={programCycle}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(await screen.findByText('Teamwork')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(api.getYouthProgramCycleAttendance).toHaveBeenCalledWith(
      'youth-1',
      { programId: 'program-1', cycleId: 'cycle-1' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Attendance for Teamwork/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Late' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.setYouthProgramCycleAttendance).toHaveBeenCalledWith(
      'youth-1',
      { programId: 'program-1', cycleId: 'cycle-1' },
      [
        { sessionId: 'session-2', status: 'late', notes: null },
        { sessionId: 'session-1', status: 'present', notes: 'Participated fully' },
      ],
    ));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  });

  it('shows a load failure without enabling a destructive save', async () => {
    api.getYouthProgramCycleAttendance.mockRejectedValue(new Error('Attendance unavailable'));
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1', programCycles: [programCycle] })}
        programCycle={programCycle}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Attendance unavailable');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});
