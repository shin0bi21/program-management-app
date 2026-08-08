import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import render from '../../../../tests/renderWithQueryClient';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import YouthAttendanceModal from './YouthAttendanceModal';

const api = vi.hoisted(() => ({
  getYouthCohortAttendance: vi.fn(),
  setYouthCohortAttendance: vi.fn(),
}));

vi.mock('./youthAttendance.api', () => api);

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
      cancelledAt: null, status: null, notes: null,
    },
    {
      id: 'session-1', sessionTypeName: 'Workshop', theme: 'Communication',
      startsAt: '2026-07-14T21:00:00.000Z', endsAt: '2026-07-14T22:00:00.000Z',
      cancelledAt: null, status: 'present' as const, notes: 'Participated fully',
    },
  ],
};

describe('YouthAttendanceModal', () => {
  beforeEach(() => {
    api.getYouthCohortAttendance.mockResolvedValue(attendance);
    api.setYouthCohortAttendance.mockResolvedValue(attendance);
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
