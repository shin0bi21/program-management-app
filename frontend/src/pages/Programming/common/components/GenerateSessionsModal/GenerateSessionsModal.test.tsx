import { fireEvent, screen, waitFor } from '@testing-library/react';
import render from '../../../../../tests/renderWithQueryClient';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramCohort } from '../../../../../common/types/cohort';
import GenerateSessionsModal from './GenerateSessionsModal';

const generateSessions = vi.fn();
const regularTypeId = '00000000-0000-4000-8000-000000000001';

vi.mock('../../../../../common/features/programming/api/programming.api', () => ({
  generateSessions: (...args: unknown[]) => generateSessions(...args),
  getSessionTypes: () => Promise.resolve([
    { id: '00000000-0000-4000-8000-000000000001', name: 'Regular' },
    { id: 'type-guest', name: 'Guest Speaker' },
  ]),
}));

const cohort: ProgramCohort = {
  id: 'cohort-1',
  programId: 'program-1',
  programName: 'Soft Skills',
  rosterMode: 'enrolled',
  minAge: 12,
  maxAge: 15,
  cycleId: 'cycle-summer-2026',
  cycleName: 'Summer 2026',
  name: 'Summer 2026',
  startsOn: '2026-07-01',
  endsOn: '2026-08-31',
  state: 'active',
  enrolledCount: 5,
  nextSessionAt: null,
  nextSessionId: null,
  averageAttendance: null,
  attendanceAttendedCount: 0,
  attendanceRecordedCount: 0,
  uniqueAttendeeCount: 0,
};

describe('GenerateSessionsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateSessions.mockResolvedValue({
      sessions: [{ id: 'session-1' }, { id: 'session-2' }],
    });
  });

  it('includes the selected weekday for a weekly schedule', async () => {
    render(<GenerateSessionsModal cohort={cohort} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Cohort' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Day of week' })).toHaveTextContent('Tuesday');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Type' })).toHaveTextContent('Regular'));
    fireEvent.change(screen.getByLabelText('Theme (optional)'), { target: { value: 'Communication' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Sessions' }));

    await waitFor(() => expect(generateSessions).toHaveBeenCalledWith('cohort-1', expect.objectContaining({
      frequency: 'weekly',
      sessionTypeId: regularTypeId,
      dayOfWeek: 'tuesday',
      startsOn: '2026-07-01',
      endsOn: '2026-08-31',
    })));
    expect(await screen.findByText(
      '2 sessions successfully added to Soft Skills - Summer 2026.',
    )).toBeInTheDocument();
  });

  it('selects a cohort and schedules in one step from the Sessions page', async () => {
    render(
      <GenerateSessionsModal
        cohort={null}
        cohorts={[cohort]}
        isOpen
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Add sessions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cohort' })).toHaveTextContent(
      'Soft Skills · Summer 2026',
    );
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Sessions' }));

    await waitFor(() => expect(generateSessions).toHaveBeenCalledWith(
      cohort.id,
      expect.objectContaining({ startsOn: cohort.startsOn, endsOn: cohort.endsOn }),
    ));
  });

  it('switches monthly schedules to a day-of-month selector', async () => {
    render(<GenerateSessionsModal cohort={cohort} onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Frequency' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Monthly' }));
    expect(screen.getByRole('button', { name: 'Day of month' })).toHaveTextContent('1st');
    fireEvent.click(screen.getByRole('button', { name: 'Day of month' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: '15th' }));
    fireEvent.change(screen.getByLabelText('Theme (optional)'), { target: { value: 'Monthly Workshop' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Sessions' }));

    await waitFor(() => expect(generateSessions).toHaveBeenCalledWith('cohort-1', expect.objectContaining({
      frequency: 'monthly',
      dayOfMonth: 15,
    })));
  });
});
