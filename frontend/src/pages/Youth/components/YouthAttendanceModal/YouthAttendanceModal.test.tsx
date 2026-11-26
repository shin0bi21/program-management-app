import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttendanceGroup } from '../../../../common/features/Attendance/attendance.api';
import { renderWithQueryClient as render } from '../../../../tests/queryClientTestUtils';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import YouthAttendanceModal from './YouthAttendanceModal';

const api = vi.hoisted(() => ({
  setAttendance: vi.fn(),
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
  cycle: 'Summer 2026',
  programId: 'program-1',
  program: 'Soft Skills',
  enrollmentRequired: true,
  startsOn: '2026-06-01',
  endsOn: '2026-08-31',
  enrolledOn: '2026-06-01',
  withdrawnOn: null,
};

const attendance = {
  programCycle: {
    programId: programCycle.programId,
    cycleId: programCycle.cycleId,
    cycle: programCycle.cycle,
    program: programCycle.program,
    enrollmentRequired: programCycle.enrollmentRequired,
  },
  averageAttendance: 50,
  youth: [{ id: 'youth-1', firstName: 'Jamie', lastName: 'Test', presentCount: 1, lateCount: 0, absentCount: 1, sessions: [
    {
      id: 'session-2', sessionType: 'Regular', title: 'Teamwork',
      date: '2026-07-21', startTime: '17:00', completed: true,
      cancelledAt: null, status: null, notes: null, sessionNotes: [],
    },
    {
      id: 'session-1', sessionType: 'Regular', title: 'Communication',
      date: '2026-07-14', startTime: '17:00', completed: true,
      cancelledAt: null, status: 'present', notes: 'Participated fully',
      sessionNotes: [{
        id: 'note-1', sessionId: 'session-1', category: 'achievement',
        details: 'Led the opening activity.',
        createdAt: '2026-07-14T22:00:00.000Z', updatedAt: '2026-07-14T22:00:00.000Z',
        createdByName: 'Bilal Khan',
        youth: [{ youthId: 'youth-1', firstName: 'Jamie', lastName: 'Test' }],
      }],
    },
  ] }],
} satisfies AttendanceGroup;

describe('YouthAttendanceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.setAttendance.mockResolvedValue({
      attendance: { groups: [attendance] }, updatedYouth: makeYouthProfile(),
    });
    sessionNoteApi.createSessionNote.mockResolvedValue({});
    sessionNoteApi.unlinkSessionNoteYouth.mockResolvedValue(undefined);
    sessionNoteApi.getSessionRoster.mockResolvedValue([
      { youthId: 'youth-1', firstName: 'Jamie', lastName: 'Test', status: 'present', notes: null },
    ]);
  });

  it('opens and closes details for the selected session note', async () => {
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1' })}
        attendance={attendance}
        refresh={vi.fn().mockResolvedValue(undefined)}
        canManageSessionNotes
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View session note' }));
    const detailsDialog = screen.getByRole('dialog', { name: 'Session Note' });
    expect(screen.getByText('Led the opening activity.')).toBeInTheDocument();
    fireEvent.click(within(detailsDialog).getByText('Close'));
    expect(screen.queryByRole('dialog', { name: 'Session Note' })).not.toBeInTheDocument();
  });

  it('adds a prelinked youth note without showing link controls', async () => {
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1' })}
        attendance={attendance}
        refresh={vi.fn().mockResolvedValue(undefined)}
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
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'General' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(sessionNoteApi.createSessionNote).toHaveBeenCalledWith(
      'session-2',
      expect.objectContaining({ details: 'Good teamwork', youthIds: ['youth-1'] }),
    ));
  });

  it('opens the editor for the selected session note', async () => {
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1' })}
        attendance={attendance}
        refresh={vi.fn().mockResolvedValue(undefined)}
        canManageSessionNotes
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Edit session note' }));
    const editor = await screen.findByRole('dialog', { name: 'Edit Note' });
    expect(within(editor).getByRole('textbox', { name: 'Note *' })).toHaveValue('Led the opening activity.');
  });

  it('uses supplied cycle sessions and saves statuses for only the selected youth', async () => {
    const onSaved = vi.fn();
    render(
      <YouthAttendanceModal
        youth={makeYouthProfile({ id: 'youth-1' })}
        attendance={attendance}
        refresh={vi.fn().mockResolvedValue(undefined)}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(await screen.findByText('Teamwork')).toBeInTheDocument();
    expect(screen.getByText('Communication')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Attendance for Teamwork/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Late' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.setAttendance).toHaveBeenCalledWith(
      'youth-1',
      { programId: 'program-1', cycleId: 'cycle-1' },
      [
        { sessionId: 'session-2', status: 'late', notes: null },
        { sessionId: 'session-1', status: 'present', notes: 'Participated fully' },
      ],
    ));
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  });
});
