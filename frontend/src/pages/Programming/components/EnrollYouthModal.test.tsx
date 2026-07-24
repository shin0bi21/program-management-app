import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeYouthProfile } from '../../../tests/factories/youth';
import EnrollYouthModal from './EnrollYouthModal';

const api = vi.hoisted(() => ({
  enrollYouth: vi.fn(),
  getYouth: vi.fn(),
}));

vi.mock('../../../common/api/cohorts.api', () => ({
  enrollYouth: api.enrollYouth,
}));
vi.mock('../../../common/api/youth.api', () => ({
  getYouth: api.getYouth,
}));

describe('EnrollYouthModal', () => {
  const cohort = {
    id: 'cohort-1',
    programId: 'program-1',
    programName: 'Soft Skills',
    name: 'Summer 2026',
    startsOn: '2026-06-30',
    endsOn: '2026-08-31',
    state: 'active' as const,
    enrolledCount: 1,
    nextSessionAt: null,
    nextSessionId: null,
    averageAttendance: null,
    attendanceAttendedCount: 0,
    attendanceRecordedCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getYouth.mockResolvedValue([
      makeYouthProfile({ id: 'youth-1', firstName: 'Jamie', lastName: 'One' }),
      makeYouthProfile({ id: 'youth-2', firstName: 'Morgan', lastName: 'Two' }),
      makeYouthProfile({
        id: 'youth-3',
        firstName: 'Already',
        lastName: 'Enrolled',
        cohorts: [{
          id: cohort.id,
          name: cohort.name,
          programId: cohort.programId,
          programName: cohort.programName,
          startsOn: cohort.startsOn,
          endsOn: cohort.endsOn,
          enrolledOn: cohort.startsOn,
          withdrawnOn: null,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
          lastAttendedOn: null,
        }],
      }),
    ]);
    api.enrollYouth.mockResolvedValue([]);
  });

  it('enrolls every checked youth in one request', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    let completeEnrollment: (value: unknown[]) => void = () => {};
    api.enrollYouth.mockReturnValue(new Promise(resolve => {
      completeEnrollment = resolve;
    }));
    render(
      <EnrollYouthModal
        cohort={cohort}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    await user.click(await screen.findByRole('checkbox', { name: 'Jamie One' }));
    await user.click(screen.getByRole('checkbox', { name: 'Morgan Two' }));
    expect(screen.queryByRole('checkbox', { name: 'Already Enrolled' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Enroll 2 Youth' }));

    expect(api.enrollYouth).toHaveBeenCalledWith('cohort-1', {
      youthIds: ['youth-1', 'youth-2'],
    });
    expect(screen.getByText('Adding 2 youth to Soft Skills - Summer 2026...')).toBeInTheDocument();

    await act(async () => {
      completeEnrollment([]);
    });

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(await screen.findByText(
      '2 youth successfully added to Soft Skills - Summer 2026.',
    )).toBeInTheDocument();
  });
});
