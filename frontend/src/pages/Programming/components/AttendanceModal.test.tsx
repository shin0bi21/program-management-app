import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CohortSession } from '../../../common/types/cohort';
import AttendanceModal from './AttendanceModal';

const api = vi.hoisted(() => ({
  getSessionRoster: vi.fn(),
  saveSessionAttendance: vi.fn(),
}));

vi.mock('../../../common/api/cohorts.api', () => api);

const session: CohortSession = {
  id: 'session-1',
  activityId: 'activity-1',
  cohortId: 'cohort-1',
  activityName: 'Weekly Soft Skills',
  focus: 'Communication',
  cohortName: 'Summer 2026',
  programId: 'program-1',
  programName: 'Soft Skills',
  startsAt: '2026-07-28T21:00:00.000Z',
  endsAt: '2026-07-28T23:30:00.000Z',
  cancelledAt: null,
  notes: null,
};

describe('AttendanceModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getSessionRoster.mockResolvedValue([{
      youthId: 'youth-1',
      firstName: 'Maya',
      lastName: 'Thompson',
      status: 'present',
      notes: null,
    }]);
    api.saveSessionAttendance.mockResolvedValue([]);
  });

  it('shows saving and success feedback before closing', async () => {
    const user = userEvent.setup();
    let finishSave: (value: unknown[]) => void = () => {};
    api.saveSessionAttendance.mockReturnValue(new Promise(resolve => {
      finishSave = resolve;
    }));
    const onSaved = vi.fn().mockResolvedValue(undefined);

    render(
      <AttendanceModal
        session={session}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );

    await screen.findByText('Maya Thompson');
    await user.click(screen.getByRole('button', { name: 'Save Attendance' }));

    expect(screen.getByText('Saving attendance for Communication...')).toBeInTheDocument();
    finishSave([]);

    expect(await screen.findByText(
      'Attendance successfully saved for Communication.',
    )).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledOnce();
  });
});
