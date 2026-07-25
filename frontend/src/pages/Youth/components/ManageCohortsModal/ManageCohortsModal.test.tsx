import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeYouthProfile } from '../../../../tests/factories/youth';
import ManageCohortsModal from './ManageCohortsModal';

const cohortApi = vi.hoisted(() => ({
  getCohorts: vi.fn(),
  syncYouthCohorts: vi.fn(),
}));

vi.mock('../../../../common/api/cohorts.api', () => cohortApi);

const cohorts = [
  {
    id: 'open-cohort',
    programId: 'drop-in',
    programName: 'Drop In',
    rosterMode: 'open',
    name: 'Summer Drop In',
    startsOn: '2026-06-30',
    endsOn: '2026-08-31',
    state: 'active',
    enrolledCount: 0,
    nextSessionAt: null,
    nextSessionId: null,
    averageAttendance: 100,
    attendanceAttendedCount: 2,
    attendanceRecordedCount: 2,
    uniqueAttendeeCount: 2,
  },
  {
    id: 'active-cohort',
    programId: 'soft-skills',
    programName: 'Soft Skills',
    rosterMode: 'enrolled',
    name: 'Summer 2026',
    startsOn: '2026-06-30',
    endsOn: '2026-08-31',
    state: 'active',
    enrolledCount: 1,
    nextSessionAt: null,
    nextSessionId: null,
    averageAttendance: null,
    attendanceAttendedCount: 0,
    attendanceRecordedCount: 0,
    uniqueAttendeeCount: 0,
  },
  {
    id: 'upcoming-cohort',
    programId: 'job-readiness',
    programName: 'Job Readiness',
    rosterMode: 'enrolled',
    name: 'Fall 2026',
    startsOn: '2026-09-01',
    endsOn: '2026-11-30',
    state: 'upcoming',
    enrolledCount: 0,
    nextSessionAt: null,
    nextSessionId: null,
    averageAttendance: null,
    attendanceAttendedCount: 0,
    attendanceRecordedCount: 0,
    uniqueAttendeeCount: 0,
  },
  {
    id: 'completed-cohort',
    programId: 'soft-skills',
    programName: 'Soft Skills',
    rosterMode: 'enrolled',
    name: 'Spring 2026',
    startsOn: '2026-03-01',
    endsOn: '2026-05-31',
    state: 'completed',
    enrolledCount: 1,
    nextSessionAt: null,
    nextSessionId: null,
    averageAttendance: 90,
    attendanceAttendedCount: 9,
    attendanceRecordedCount: 10,
    uniqueAttendeeCount: 1,
  },
] as const;

describe('ManageCohortsModal', () => {
  beforeEach(() => {
    cohortApi.getCohorts.mockReset();
    cohortApi.syncYouthCohorts.mockReset();
    cohortApi.getCohorts.mockResolvedValue(cohorts);
    cohortApi.syncYouthCohorts.mockResolvedValue([]);
  });

  it('allows multiple active or upcoming cohorts and excludes completed cohorts', async () => {
    const onChanged = vi.fn().mockResolvedValue(undefined);
    render(
      <ManageCohortsModal
        youth={makeYouthProfile()}
        onClose={vi.fn()}
        onChanged={onChanged}
      />,
    );

    expect(await screen.findByRole('checkbox', { name: /Soft Skills · Summer 2026/ })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Job Readiness · Fall 2026/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Spring 2026/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Summer Drop In/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /Soft Skills · Summer 2026/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Job Readiness · Fall 2026/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply Changes' }));

    await waitFor(() => expect(cohortApi.syncYouthCohorts).toHaveBeenCalledWith(
      expect.any(String),
      ['active-cohort', 'upcoming-cohort'],
    ));
    expect(onChanged).toHaveBeenCalled();
    expect(await screen.findByText(/Cohorts successfully updated/)).toBeInTheDocument();
  });

  it('starts with current manageable enrollments selected and disables unchanged saves', async () => {
    render(
      <ManageCohortsModal
        youth={makeYouthProfile({
          cohorts: [{
            id: 'active-cohort',
            name: 'Summer 2026',
            programId: 'soft-skills',
            programName: 'Soft Skills',
            rosterMode: 'enrolled',
            startsOn: '2026-06-30',
            endsOn: '2026-08-31',
            enrolledOn: '2026-06-30',
            withdrawnOn: null,
            presentCount: 0,
            lateCount: 0,
            absentCount: 0,
            lastAttendedOn: null,
          }],
        })}
        onClose={vi.fn()}
        onChanged={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(await screen.findByRole('checkbox', { name: /Soft Skills · Summer 2026/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Apply Changes' })).toBeDisabled();
  });
});
