import { act, screen } from '@testing-library/react';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeYouthProfile } from '../../../../../tests/factories/youth';
import EnrollYouthModal from './EnrollYouthModal';

const api = vi.hoisted(() => ({
  enrollYouth: vi.fn(),
  getYouth: vi.fn(),
}));

vi.mock('../../../../../common/features/programming/api/cohorts.api', () => ({
  enrollYouth: api.enrollYouth,
}));
vi.mock('../../../../../common/features/youth/youth.api', () => ({
  getYouth: api.getYouth,
}));

const birthDateForAge = (age: number) => `${new Date().getFullYear() - age}-01-01`;

describe('EnrollYouthModal', () => {
  const cohort = {
    id: 'cohort-1',
    programId: 'program-1',
    programName: 'Soft Skills',
    rosterMode: 'enrolled' as const,
    minAge: 12,
    maxAge: 15,
    cycleId: 'cycle-summer-2026',
    cycleName: 'Summer 2026',
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
    uniqueAttendeeCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getYouth.mockResolvedValue([
      makeYouthProfile({
        id: 'youth-1',
        firstName: 'Jamie',
        lastName: 'One',
        dateOfBirth: birthDateForAge(14),
      }),
      makeYouthProfile({
        id: 'youth-2',
        firstName: 'Morgan',
        lastName: 'Two',
        dateOfBirth: birthDateForAge(13),
      }),
      makeYouthProfile({
        id: 'youth-3',
        firstName: 'Already',
        lastName: 'Enrolled',
        cohorts: [{
          id: cohort.id,
          name: cohort.name,
          programId: cohort.programId,
          programName: cohort.programName,
          rosterMode: 'enrolled',
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

    expect(screen.getByRole('heading', {
      name: 'Soft Skills - Summer 2026 Enrollment',
    })).toBeInTheDocument();
    await user.click(await screen.findByRole('checkbox', { name: 'Jamie One' }));
    await user.click(screen.getByRole('checkbox', { name: 'Morgan Two' }));
    expect(screen.queryByRole('checkbox', { name: 'Already Enrolled' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Enroll 2 Youth' }));

    expect(api.enrollYouth).toHaveBeenCalledWith('cohort-1', {
      youthIds: ['youth-1', 'youth-2'],
    });
    expect(screen.getByText('Adding 2 youth to Soft Skills - Summer 2026...')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search youth' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Jamie One' })).toBeDisabled();

    await act(async () => {
      completeEnrollment([]);
    });

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(await screen.findByText(
      '2 youth successfully added to Soft Skills - Summer 2026.',
    )).toBeInTheDocument();
  });

  it('defaults to the program age range and can be disabled for exceptions', async () => {
    const user = userEvent.setup();
    api.getYouth.mockResolvedValue([
      makeYouthProfile({
        id: 'eligible',
        firstName: 'Eligible',
        lastName: 'Youth',
        dateOfBirth: birthDateForAge(14),
      }),
      makeYouthProfile({
        id: 'older',
        firstName: 'Older',
        lastName: 'Youth',
        dateOfBirth: birthDateForAge(17),
      }),
      makeYouthProfile({
        id: 'unknown',
        firstName: 'Unknown',
        lastName: 'Age',
        dateOfBirth: null,
      }),
    ]);

    render(
      <EnrollYouthModal
        cohort={cohort}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(await screen.findByRole('group', { name: 'Youth age filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ages 12–15' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'All ages' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(await screen.findByRole('checkbox', { name: 'Eligible Youth' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Older Youth' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Unknown Age' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All ages' }));

    expect(screen.getByRole('button', { name: 'All ages' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('checkbox', { name: 'Older Youth' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Unknown Age' })).toBeInTheDocument();
  });
});
