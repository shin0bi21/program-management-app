import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramCohort } from '../../../common/types/cohort';
import GenerateSessionsModal from './GenerateSessionsModal';

const generateSessions = vi.fn();

vi.mock('../../../common/api/cohorts.api', () => ({
  generateSessions: (...args: unknown[]) => generateSessions(...args),
}));

const cohort: ProgramCohort = {
  id: 'cohort-1',
  programId: 'program-1',
  programName: 'Soft Skills',
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
};

describe('GenerateSessionsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateSessions.mockResolvedValue({
      activityId: 'activity-1',
      sessions: [{ id: 'session-1' }, { id: 'session-2' }],
    });
  });

  it('includes the selected weekday for a weekly schedule', async () => {
    render(<GenerateSessionsModal cohort={cohort} onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Day of week' })).toHaveTextContent('Tuesday');
    fireEvent.change(screen.getByLabelText('Activity'), { target: { value: 'Weekly Soft Skills' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Sessions' }));

    await waitFor(() => expect(generateSessions).toHaveBeenCalledWith('cohort-1', expect.objectContaining({
      frequency: 'weekly',
      dayOfWeek: 'tuesday',
      startsOn: '2026-07-01',
      endsOn: '2026-08-31',
    })));
    expect(await screen.findByText(
      '2 sessions successfully added to Soft Skills - Summer 2026.',
    )).toBeInTheDocument();
  });

  it('switches monthly schedules to a day-of-month selector', async () => {
    render(<GenerateSessionsModal cohort={cohort} onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Frequency' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Monthly' }));
    expect(screen.getByRole('button', { name: 'Day of month' })).toHaveTextContent('1st');
    fireEvent.click(screen.getByRole('button', { name: 'Day of month' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: '15th' }));
    fireEvent.change(screen.getByLabelText('Activity'), { target: { value: 'Monthly Workshop' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Sessions' }));

    await waitFor(() => expect(generateSessions).toHaveBeenCalledWith('cohort-1', expect.objectContaining({
      frequency: 'monthly',
      dayOfMonth: 15,
    })));
  });
});
